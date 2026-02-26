import SwiftUI

struct HistoryView: View {
    @State private var sessions: [PracticeSession] = []
    @State private var isLoading = false
    @State private var error: String?
    
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
                    VStack {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        Text(error)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Retry") {
                            Task { await loadSessions() }
                        }
                    }
                } else if sessions.isEmpty {
                    VStack {
                        Image(systemName: "tray")
                            .font(.largeTitle)
                            .foregroundColor(.gray)
                        Text("No sessions yet.")
                            .foregroundColor(.secondary)
                            .padding()
                    }
                } else {
                    List(sessions) { session in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(session.mode.capitalized)
                                    .font(.headline)
                                Spacer()
                                Text("\(session.messageCount) msgs")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(UIColor.tertiarySystemFill))
                                    .cornerRadius(8)
                            }
                            
                            Text(session.startTime, style: .date)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
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
            // Sort by start time descending
            sessions.sort { $0.startTime > $1.startTime }
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
