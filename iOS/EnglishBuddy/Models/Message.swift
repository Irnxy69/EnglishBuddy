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
    let text: String
    let history: [Message]
    let mode: String
}

struct ChatResponse: Decodable {
    let reply: String
}
