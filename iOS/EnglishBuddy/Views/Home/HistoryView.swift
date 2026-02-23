import SwiftUI

struct HistoryView: View {
    @State private var sessions: [PracticeSession] = []
    @State private var isLoading = false
    @State private var error: String?
    
    var body: some View {
        NavigationView {
            Group {
                if isLoading && sessions.isEmpty {
                    ProgressView("Loading history...")
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
            sessions = try await APIClient.shared.request(endpoint: .getSessions)
            // Sort by start time descending
            sessions.sort { $0.startTime > $1.startTime }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
