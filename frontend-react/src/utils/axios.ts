import axios from "axios";

const api = axios.create({
  baseURL: "http://my.appserver.test", // Replace with your actual API URL
});

// Request Interceptor to add the token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers["X-Auth-Token"] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try refreshing it
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await api.post("/api/core/renew", {
            refresh_token: refreshToken,
          });
          const { access_token } = data;

          // Save new access token
          localStorage.setItem("accessToken", access_token);

          // Retry the failed request with the new access token
          error.config.headers["X-Auth-Token"] = access_token;
          return axios(error.config); // Retry the original request
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          // Handle token refresh failure (e.g., log out)
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
