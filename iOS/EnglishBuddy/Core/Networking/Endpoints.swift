import Foundation

enum APIEndpoint {
    static let baseURL = "https://englishbuddy.top/api"
    
    case login
    case register
    case createSession(mode: String)
    case chat
    case getSessions
    case getSession(sessionId: String)
    case generateReport
    
    var url: URL {
        switch self {
        case .login:
            return URL(string: "\(APIEndpoint.baseURL)/auth/login")!
        case .register:
            return URL(string: "\(APIEndpoint.baseURL)/auth/register")!
        case .createSession(let mode):
            return URL(string: "\(APIEndpoint.baseURL)/sessions?mode=\(mode)")!
        case .chat:
            return URL(string: "\(APIEndpoint.baseURL)/chat")!
        case .getSessions:
            return URL(string: "\(APIEndpoint.baseURL)/sessions")!
        case .getSession(let sessionId):
            return URL(string: "\(APIEndpoint.baseURL)/sessions/\(sessionId)")!
        case .generateReport:
            return URL(string: "\(APIEndpoint.baseURL)/report/generate")!
        }
    }
}
