import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    
    @State private var isLoginMode = true
    @State private var email = ""
    @State private var password = ""
    
    var body: some View {
        ZStack {
            Color("Background").ignoresSafeArea() // Will use system black/gray if not defined
            
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.indigo)
                        .padding(.bottom, 10)
                    
                    Text(isLoginMode ? "Welcome Back" : "Create Account")
                        .font(.largeTitle)
                        .bold()
                        .foregroundColor(.primary)
                    
                    Text("EnglishBuddy Native")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 60)
                .padding(.bottom, 30)
                
                // Form
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                    
                    SecureField("Password", text: $password)
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                }
                .padding(.horizontal)
                
                if let error = authVM.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                
                // Action Button
                Button(action: {
                    Task {
                        if isLoginMode {
                            await authVM.login(email: email, password: password)
                        } else {
                            await authVM.register(email: email, password: password)
                        }
                    }
                }) {
                    HStack {
                        Spacer()
                        if authVM.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text(isLoginMode ? "Sign In" : "Sign Up")
                                .fontWeight(.bold)
                        }
                        Spacer()
                    }
                    .padding()
                    .foregroundColor(.white)
                    .background(Color.indigo)
                    .cornerRadius(12)
                }
                .disabled(authVM.isLoading || email.isEmpty || password.isEmpty)
                .padding(.horizontal)
                
                // Toggle Mode
                Button(action: {
                    withAnimation {
                        isLoginMode.toggle()
                        authVM.error = nil
                    }
                }) {
                    Text(isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In")
                        .font(.footnote)
                        .foregroundColor(.indigo)
                }
                .padding(.top, 10)
                
                Spacer()
            }
        }
    }
}
