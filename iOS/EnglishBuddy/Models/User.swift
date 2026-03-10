import Foundation

struct User: Codable {
    let email: String
    let userId: String
    
    enum CodingKeys: String, CodingKey {
        case email
        case userId = "user_id"
    }
}

/// Backend returns: {access_token, token_type, user_id, email}
struct TokenResponse: Decodable {
    let accessToken: String
    let tokenType: String
    let userId: String
    let email: String
    
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case userId = "user_id"
        case email
    }
    
    var user: User {
        User(email: email, userId: userId)
    }
}
