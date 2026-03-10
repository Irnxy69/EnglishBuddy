import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var chatVM: ChatViewModel
    @State private var sessions: [PracticeSession] = []
    @State private var isLoading = false
    @State private var error: String?
    
    private let modeIcons: [String: String] = [
        "ielts": "🎓",
        "daily": "☕",
        "interview": "💼"
    ]
    
    private let modeColors: [String: Color] = [
        "ielts": .indigo,
        "daily": .cyan,
        "interview": .orange
    ]
    
    var body: some View {
        NavigationView {
            Group {
                if isLoading && sessions.isEmpty {
                    List {
                        ForEach(0..<6, id: \.self) { _ in
                            SkeletonRow()
                        }
                    }
                } else if let error = error {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        Text(error)
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        Button("Retry") {
                            Task { await loadSessions() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.indigo)
                    }
                } else if sessions.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("No sessions yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Start a practice session to see your history here.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                } else {
                    List(sessions) { session in
                        Button(action: {
                            Task {
                                await chatVM.loadSession(sessionId: session.id)
                            }
                        }) {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(modeIcons[session.mode] ?? "💬")
                                    Text(session.mode.capitalized)
                                        .font(.headline)
                                    Spacer()
                                    if session.endedAt != nil {
                                        Text("Completed")
                                            .font(.caption2)
                                            .foregroundColor(.green)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color.green.opacity(0.15))
                                            .cornerRadius(8)
                                    }
                                }
                                
                                Text(session.formattedDate)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .foregroundColor(.primary)
                    }
                    .refreshable {
                        await loadSessions()
                    }
                }
            }
            .navigationTitle("History")
            .onAppear {
                Task { await loadSessions() }
            }
        }
    }
    
    private func loadSessions() async {
        isLoading = true
        error = nil
        do {
            let response: SessionsResponse = try await APIClient.shared.request(endpoint: .getSessions)
            sessions = response.sessions
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// Skeleton Loader
struct SkeletonRow: View {
    @State private var opacity: Double = 0.3
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(UIColor.tertiarySystemFill))
                    .frame(width: 80, height: 20)
                Spacer()
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(UIColor.tertiarySystemFill))
                    .frame(width: 50, height: 20)
            }
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(UIColor.tertiarySystemFill))
                .frame(width: 140, height: 16)
        }
        .padding(.vertical, 8)
        .opacity(opacity)
        .onAppear {
            let baseAnimation = Animation.easeInOut(duration: 0.8)
            let repeated = baseAnimation.repeatForever(autoreverses: true)
            withAnimation(repeated) {
                opacity = 0.8
            }
        }
    }
}
