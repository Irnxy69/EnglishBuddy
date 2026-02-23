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
        
        do {
            let body = ["mode": mode]
            let response: CreateSessionResponse = try await APIClient.shared.request(
                endpoint: .createSession(mode: mode),
                method: "POST",
                body: body
            )
            self.currentSessionId = response.sessionId
        } catch {
            self.error = "Failed to create session: \(error.localizedDescription)"
        }
        
        isAIThinking = false
    }
    
    func toggleRecording() {
        if speechRecognizer.isRecording {
            // Stop recording and send message
            speechRecognizer.stopTranscribing()
            let userText = speechRecognizer.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            if !userText.isEmpty {
                Task {
                    await sendMessage(text: userText)
                }
            }
        } else {
            // Start recording
            error = nil
            tts.stop()
            speechRecognizer.startTranscribing()
        }
    }
    
    func sendMessage(text: String) async {
        guard let sessionId = currentSessionId, !text.isEmpty else { return }
        
        let userMessage = Message(role: .user, content: text)
        messages.append(userMessage)
        
        isAIThinking = true
        error = nil
        
        do {
            // Context window: send all previous messages except the new one we just appended
            let historyToSend = Array(messages.dropLast())
            let body = ChatRequest(text: text, history: historyToSend, mode: self.currentMode)
            
            let response: ChatResponse = try await APIClient.shared.request(
                endpoint: .chat(sessionId: sessionId),
                method: "POST",
                body: ["text": body.text, "history": body.history.map { ["role": $0.role.rawValue, "content": $0.content] }, "mode": body.mode]
            )
            
            let aiMessage = Message(role: .assistant, content: response.reply)
            self.messages.append(aiMessage)
            
            // Speak the reply
            self.tts.speak(text: response.reply)
            
        } catch {
            self.error = "Failed to send message: \(error.localizedDescription)"
            // Remove the user message if it failed to send
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
            let body = ["messages": messages.map { ["role": $0.role.rawValue, "content": $0.content] }]
            let response: ReportResponse = try await APIClient.shared.request(
                endpoint: .getReport(sessionId: sessionId),
                method: "POST",
                body: body
            )
            
            self.currentReport = response.content
            self.showReport = true
        } catch {
            self.error = "Failed to generate report: \(error.localizedDescription)"
        }
        
        isAIThinking = false
    }
}
