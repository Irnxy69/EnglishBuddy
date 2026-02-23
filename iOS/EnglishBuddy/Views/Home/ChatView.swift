import SwiftUI

struct ChatView: View {
    @StateObject private var vm = ChatViewModel()
    @State private var inputText = ""
    @State private var showModeMenu = false
    
    // Auto-scroll anchor
    @Namespace var bottomID
    
    var body: some View {
        NavigationView {
            ZStack {
                Color("Background", bundle: nil).ignoresSafeArea()
                
                VStack(spacing: 0) {
                    
                    // Mode Selector Bar
                    Button(action: { showModeMenu = true }) {
                        HStack {
                            Image(systemName: "graduationcap.fill")
                            Text("IELTS Mode")
                            Image(systemName: "chevron.down")
                        }
                        .font(.subheadline.bold())
                        .foregroundColor(.indigo)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(Color.indigo.opacity(0.15))
                        .clipShape(Capsule())
                    }
                    .padding(.top, 8)
                    
                    // Messages Area
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 16) {
                                if vm.messages.isEmpty {
                                    VStack(spacing: 16) {
                                        Image(systemName: "mic.bubble.fill")
                                            .font(.system(size: 60))
                                            .foregroundColor(.gray)
                                        Text("Hold the microphone below to speak, or type a message.")
                                            .multilineTextAlignment(.center)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(.top, 100)
                                }
                                
                                ForEach(vm.messages) { msg in
                                    MessageBubble(message: msg)
                                }
                                
                                if vm.isAIThinking {
                                    HStack {
                                        ProgressView()
                                            .padding()
                                            .background(Color(UIColor.secondarySystemBackground))
                                            .cornerRadius(16)
                                        Spacer()
                                    }
                                }
                                
                                // Auto-scroll target
                                Color.clear
                                    .frame(height: 1)
                                    .id(bottomID)
                            }
                            .padding()
                        }
                        .onChange(of: vm.messages.count) { _ in
                            withAnimation {
                                proxy.scrollTo(bottomID, anchor: .bottom)
                            }
                        }
                        .onChange(of: vm.speechRecognizer.transcript) { _ in
                            withAnimation {
                                proxy.scrollTo(bottomID, anchor: .bottom)
                            }
                        }
                    }
                    
                    // Error Bar
                    if let error = vm.error ?? vm.speechRecognizer.errorMsg {
                        HStack {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                            Spacer()
                            Button(action: { vm.error = nil; vm.speechRecognizer.errorMsg = nil }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                        .padding()
                        .background(Color.red.opacity(0.1))
                    }
                    
                    // Real-time transcription preview
                    if vm.speechRecognizer.isRecording {
                        Text(vm.speechRecognizer.transcript.isEmpty ? "Listening..." : vm.speechRecognizer.transcript)
                            .font(.callout)
                            .italic()
                            .foregroundColor(.indigo)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.indigo.opacity(0.1))
                    }
                    
                    // Bottom Control Bar
                    HStack(spacing: 12) {
                        // Text Input
                        TextField("Type a message...", text: $inputText)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(20)
                            .onSubmit {
                                Task {
                                    if !inputText.isEmpty {
                                        let textToSend = inputText
                                        inputText = ""
                                        await vm.sendMessage(text: textToSend)
                                    }
                                }
                            }
                        
                        // Send Text Button (visible if typing)
                        if !inputText.isEmpty {
                            Button(action: {
                                Task {
                                    let textToSend = inputText
                                    inputText = ""
                                    await vm.sendMessage(text: textToSend)
                                }
                            }) {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundColor(.indigo)
                            }
                        } else {
                            // Voice Record Button (visible if empty)
                            RecordButton(isRecording: vm.speechRecognizer.isRecording) {
                                vm.toggleRecording()
                            }
                        }
                    }
                    .padding()
                    .background(Color(UIColor.systemBackground).ignoresSafeArea())
                }
            }
            .navigationTitle("Practice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task { await vm.startNewSession() }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        Task { await vm.generateReport() }
                    }) {
                        Image(systemName: "chart.bar.doc.horizontal")
                    }
                    .disabled(vm.messages.count < 4)
                }
            }
            .sheet(isPresented: $vm.showReport) {
                NavigationView {
                    ScrollView {
                        Text(vm.currentReport ?? "No report available.")
                            .padding()
                    }
                    .navigationTitle("Assessment Report")
                    .toolbar {
                        Button("Done") { vm.showReport = false }
                    }
                }
            }
            .confirmationDialog("Select Mode", isPresented: $showModeMenu, titleVisibility: .visible) {
                Button("🎓 IELTS Mode") { Task { await vm.startNewSession(mode: "ielts") } }
                Button("☕ Daily Talk") { Task { await vm.startNewSession(mode: "daily") } }
                Button("💼 Interview") { Task { await vm.startNewSession(mode: "interview") } }
                Button("Cancel", role: .cancel) { }
            }
        }
        .onAppear {
            if vm.currentSessionId == nil {
                Task { await vm.startNewSession(mode: "ielts") }
            }
        }
    }
}

// Subcomponents
struct MessageBubble: View {
    let message: Message
    
    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            
            Text(message.content)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(message.role == .user ? Color.indigo : Color(UIColor.secondarySystemBackground))
                .foregroundColor(message.role == .user ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            
            if message.role == .assistant { Spacer() }
        }
    }
}

struct RecordButton: View {
    let isRecording: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red : Color.indigo)
                    .frame(width: 44, height: 44)
                
                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                    .foregroundColor(.white)
                    .font(.system(size: 20, weight: .semibold))
            }
        }
        .scaleEffect(isRecording ? 1.1 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isRecording)
    }
}
