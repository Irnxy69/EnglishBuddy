import Foundation

struct Message: Codable, Identifiable {
    var id = UUID()
    let role: Role
    let content: String
    
    enum Role: String, Codable {
        case user
        case assistant
    }
    
    enum CodingKeys: String, CodingKey {
        case role
        case content
    }
}

struct ChatRequest: Encodable {
    let sessionId: String
    let userText: String
    let history: [Message]
    let mode: String
    
    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case userText = "user_text"
        case history
        case mode
    }
}

struct ChatResponse: Decodable {
    let reply: String
}
