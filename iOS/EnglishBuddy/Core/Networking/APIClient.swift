import Foundation

class APIClient {
    static let shared = APIClient()
    private let session = URLSession.shared
    
    private init() {}
    
    func request<T: Decodable>(endpoint: APIEndpoint, method: String = "GET", body: [String: Any]? = nil) async throws -> T {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Inject JWT Token
        if let token = KeychainManager.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.noData
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            do {
                let decoder = JSONDecoder()
                return try decoder.decode(T.self, from: data)
            } catch {
                throw NetworkError.decodingError(error)
            }
        case 401:
            throw NetworkError.unauthorized
        default:
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw NetworkError.serverError(errorResponse.detail)
            }
            throw NetworkError.serverError("Server Error \(httpResponse.statusCode)")
        }
    }
}

struct ErrorResponse: Decodable {
    let detail: String
}
