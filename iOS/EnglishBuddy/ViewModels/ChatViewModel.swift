import Foundation
import Combine

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var currentSessionId: String?
    @Published var isAIThinking = false
    @Published var error: String?
    @Published var currentMode: String = "ielts"
    
    @Published var showReport = false
    @Published var currentReport: String?
    @Published var currentBandScore: Double?
    
    let speechRecognizer = SpeechRecognizer()
    let tts = TextToSpeech()
    
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        speechRecognizer.requestAuthorization()
        
        // Auto-stop TTS when user starts speaking
        speechRecognizer.$isRecording
            .receive(on: RunLoop.main)
            .sink { [weak self] isRecording in
                if isRecording {
                    self?.tts.stop()
                }
            }
            .store(in: &cancellables)
    }
    
    func startNewSession(mode: String = "ielts") async {
        tts.stop()
        speechRecognizer.stopTranscribing()
        
        messages.removeAll()
        currentSessionId = nil
        error = nil
        isAIThinking = true
        self.currentMode = mode
        currentReport = nil
        currentBandScore = nil
        showReport = false
        
        do {
            // Backend expects mode as query param: POST /sessions?mode=ielts
            // No body needed - mode is in the URL via endpoint
            let response: CreateSessionResponse = try await APIClient.shared.request(
                endpoint: .createSession(mode: mode),
                method: "POST"
            )
            self.currentSessionId = response.sessionId
        } catch {
            self.error = "Failed to create session: \(error.localizedDescription)"
        }
        
        isAIThinking = false
    }
    
    func startRecording() {
        error = nil
        tts.stop()
        speechRecognizer.startTranscribing()
    }
    
    func stopRecordingAndSend() {
        speechRecognizer.stopTranscribing()
        
        // Wait 0.5 seconds for final transcripts to process, then send
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self else { return }
            let userText = self.speechRecognizer.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            if !userText.isEmpty {
                Task {
                    await self.sendMessage(text: userText)
                }
            } else {
                self.speechRecognizer.transcript = ""
            }
        }
    }
    
    func stopRecordingAndCancel() {
        speechRecognizer.stopTranscribing()
        speechRecognizer.transcript = ""
    }
    
    func sendMessage(text: String) async {
        guard let sessionId = currentSessionId, !text.isEmpty else { return }
        
        let userMessage = Message(role: .user, content: text)
        messages.append(userMessage)
        
        isAIThinking = true
        error = nil
        
        do {
            let historyToSend = Array(messages.dropLast())
            let body: [String: Any] = [
                "session_id": sessionId,
                "user_text": text,
                "history": historyToSend.map { ["role": $0.role.rawValue, "content": $0.content] },
                "mode": self.currentMode
            ]
            
            let response: ChatResponse = try await APIClient.shared.request(
                endpoint: .chat,
                method: "POST",
                body: body
            )
            
            let aiMessage = Message(role: .assistant, content: response.reply)
            self.messages.append(aiMessage)
            
            // Speak the reply
            self.tts.speak(text: response.reply)
            
        } catch {
            self.error = "Failed to send message: \(error.localizedDescription)"
            messages.removeLast()
        }
        
        isAIThinking = false
    }
    
    func generateReport() async {
        guard let sessionId = currentSessionId else { return }
        guard messages.count >= 4 else {
            self.error = "Please have a longer conversation first (at least 2 exchanges)."
            return
        }
        
        isAIThinking = true
        error = nil
        
        do {
            // Backend: POST /report/generate with {session_id, history}
            let body: [String: Any] = [
                "session_id": sessionId,
                "history": messages.map { ["role": $0.role.rawValue, "content": $0.content] }
            ]
            let response: ReportResponse = try await APIClient.shared.request(
                endpoint: .generateReport,
                method: "POST",
                body: body
            )
            
            self.currentReport = response.content
            self.currentBandScore = response.bandScore
            self.showReport = true
        } catch {
            self.error = "Failed to generate report: \(error.localizedDescription)"
        }
        
        isAIThinking = false
    }
    
    func loadSession(sessionId: String) async {
        isAIThinking = true
        error = nil
        
        do {
            let response: SessionDetailResponse = try await APIClient.shared.request(
                endpoint: .getSession(sessionId: sessionId),
                method: "GET"
            )
            
            self.currentSessionId = sessionId
            self.currentMode = response.session.mode
            self.messages = response.messages.map { msg in
                Message(role: msg.role == "user" ? .user : .assistant, content: msg.content)
            }
            
            if let report = response.report {
                self.currentReport = report.content
                self.currentBandScore = report.bandScore
            } else {
                self.currentReport = nil
                self.currentBandScore = nil
            }
            self.showReport = false
        } catch {
            self.error = "Failed to load session: \(error.localizedDescription)"
        }
        
        isAIThinking = false
    }
}
