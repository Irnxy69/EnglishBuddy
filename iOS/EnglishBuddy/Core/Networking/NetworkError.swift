import Foundation

enum NetworkError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(String)
    case unauthorized
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received from server"
        case .decodingError(let error): return "Failed to decode response: \(error.localizedDescription)"
        case .serverError(let message): return message
        case .unauthorized: return "Session expired. Please log in again."
        }
    }
}
