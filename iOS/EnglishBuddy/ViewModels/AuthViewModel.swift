import Foundation
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var error: String?
    @Published var isLoading = false
    
    init() {
        checkAuthStatus()
    }
    
    func checkAuthStatus() {
        if KeychainManager.shared.getToken() != nil {
            isAuthenticated = true
        } else {
            isAuthenticated = false
        }
    }
    
    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            let body = ["email": email, "password": password]
            let response: TokenResponse = try await APIClient.shared.request(endpoint: .login, method: "POST", body: body)
            
            if KeychainManager.shared.save(token: response.accessToken) {
                currentUser = response.user
                isAuthenticated = true
            } else {
                error = "Failed to save secure token"
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func register(email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            let body = ["email": email, "password": password]
            let _: [String: String] = try await APIClient.shared.request(endpoint: .register, method: "POST", body: body)
            
            // Auto-login after successful registration
            await login(email: email, password: password)
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }
    
    func logout() {
        _ = KeychainManager.shared.deleteToken()
        isAuthenticated = false
        currentUser = nil
    }
}
