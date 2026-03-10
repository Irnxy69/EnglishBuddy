import SwiftUI

struct HomeTabView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var chatVM = ChatViewModel()
    
    var body: some View {
        TabView {
            ChatView()
                .environmentObject(chatVM)
                .tabItem {
                    Label("Practice", systemImage: "mic.bubble.fill")
                }
            
            HistoryView()
                .environmentObject(chatVM)
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }
            
            // Settings / Profile
            NavigationView {
                List {
                    Section("Account") {
                        if let user = authVM.currentUser {
                            HStack {
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(.indigo)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(user.email)
                                        .font(.headline)
                                    Text("Active account")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    
                    Section("About") {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text("1.0.0")
                                .foregroundColor(.secondary)
                        }
                        HStack {
                            Text("AI Partner")
                            Spacer()
                            Text("Echo")
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Section {
                        Button(role: .destructive) {
                            authVM.logout()
                        } label: {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                Text("Log Out")
                            }
                        }
                    }
                }
                .navigationTitle("Settings")
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
        .tint(.indigo)
    }
}
