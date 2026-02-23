import Foundation

struct PracticeSession: Decodable, Identifiable {
    let id: String
    let userId: String
    let mode: String
    let startTime: Date
    let endTime: Date?
    let messageCount: Int
    
    enum CodingKeys: String, CodingKey {
        case id = "session_id"
        case userId = "user_id"
        case mode
        case startTime = "start_time"
        case endTime = "end_time"
        case messageCount = "message_count"
    }
}

struct CreateSessionResponse: Decodable {
    let sessionId: String
    let mode: String
    
    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case mode
    }
}

struct ReportResponse: Decodable {
    let reportId: String
    let content: String
    
    enum CodingKeys: String, CodingKey {
        case reportId = "report_id"
        case content
    }
}
