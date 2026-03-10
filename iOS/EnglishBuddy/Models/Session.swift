import Foundation

/// Backend returns: {id, mode, created_at, ended_at}
/// Note: user_id is NOT included in list response
struct PracticeSession: Decodable, Identifiable {
    let id: String
    let mode: String
    let createdAt: String
    let endedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case mode
        case createdAt = "created_at"
        case endedAt = "ended_at"
    }
    
    var formattedDate: String {
        // Parse ISO 8601 date
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: createdAt) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .short
            return display.string(from: date)
        }
        return createdAt
    }
}

/// Backend returns: {sessions: [...]}
struct SessionsResponse: Decodable {
    let sessions: [PracticeSession]
}

/// Backend returns: {session_id, mode}
struct CreateSessionResponse: Decodable {
    let sessionId: String
    let mode: String
    
    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case mode
    }
}

/// Backend returns: {session_id, content, band_score}
struct ReportResponse: Decodable {
    let sessionId: String
    let content: String
    let bandScore: Double?
    
    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case content
        case bandScore = "band_score"
    }
}

/// Backend returns: {session, messages, report}
struct SessionDetailResponse: Decodable {
    let session: SessionInfo
    let messages: [MessageItem]
    let report: ReportItem?
}

struct SessionInfo: Decodable {
    let id: String
    let mode: String
    let createdAt: String
    let endedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case mode
        case createdAt = "created_at"
        case endedAt = "ended_at"
    }
}

struct MessageItem: Decodable {
    let role: String
    let content: String
    let createdAt: String
    
    enum CodingKeys: String, CodingKey {
        case role
        case content
        case createdAt = "created_at"
    }
}

struct ReportItem: Decodable {
    let content: String
    let bandScore: Double?
    let createdAt: String
    
    enum CodingKeys: String, CodingKey {
        case content
        case bandScore = "band_score"
        case createdAt = "created_at"
    }
}
