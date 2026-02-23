import SwiftUI

struct HomeTabView: View {
    @EnvironmentObject var authVM: AuthViewModel
    
    var body: some View {
        TabView {
            ChatView()
                .tabItem {
                    Label("Practice", systemImage: "mic.bubble.fill")
                }
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }
            
            // Temporary Settings/Profile tab for logout
            NavigationView {
                List {
                    Section {
                        if let user = authVM.currentUser {
                            Text(user.email)
                        }
                    }
                    
                    Section {
                        Button(role: .destructive) {
                            authVM.logout()
                        } label: {
                            Text("Log Out")
                        }
                    }
                }
                .navigationTitle("Settings")
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
    }
}
