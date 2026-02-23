import Foundation

enum APIEndpoint {
    static let baseURL = "https://englishbuddy.top/api"
    
    case login
    case register
    case createSession(mode: String)
    case chat
    case getSessions
    case getReport(sessionId: String)
    
    var url: URL {
        switch self {
        case .login:
            return URL(string: "\(APIEndpoint.baseURL)/auth/login")!
        case .register:
            return URL(string: "\(APIEndpoint.baseURL)/auth/register")!
        case .createSession:
            return URL(string: "\(APIEndpoint.baseURL)/sessions")!
        case .chat:
            return URL(string: "\(APIEndpoint.baseURL)/chat")!
        case .getSessions:
            return URL(string: "\(APIEndpoint.baseURL)/sessions")!
        case .getReport(let sessionId):
            return URL(string: "\(APIEndpoint.baseURL)/report/\(sessionId)")!
        }
    }
}
