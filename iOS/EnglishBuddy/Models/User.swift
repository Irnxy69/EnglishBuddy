import Foundation

struct User: Decodable {
    let email: String
    let id: UUID?
    
    enum CodingKeys: String, CodingKey {
        case email
        case id = "user_id"
    }
}

struct TokenResponse: Decodable {
    let accessToken: String
    let tokenType: String
    let user: User?
    
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case user
    }
}
