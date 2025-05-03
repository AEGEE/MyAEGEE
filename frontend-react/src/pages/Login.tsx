import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
  Divider,
  Stack,
} from "@mui/material";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import api from "../utils/axios";
import { Link as RouterLink } from "@tanstack/react-router";

const loginApi = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}) => {
  const response = await api.post("/api/core/login", {
    username,
    password,
  });
  const { access_token, refresh_token } = response.data;
  localStorage.setItem("accessToken", access_token);
  localStorage.setItem("refreshToken", refresh_token);
  return response.data;
};

export default function Login() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { mutate, status } = useMutation({
    mutationFn: loginApi,
    onSuccess: () => {
      const to = search.to ?? "/dashboard";
      navigate({ to: decodeURI(to) });
    },
    onError: (err: any) => {
      if (err?.response?.data?.message) {
        setLocalError(err.response.data.message);
      } else {
        setLocalError("An error occurred while logging in.");
        console.error(err.message);
      }
    },
  });

  const isLoading = status === "pending";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    mutate({ username, password });
  };

  return (
    <Box
      className="login-block"
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      px={2}
    >
      <Box maxWidth={500} width="100%">
        <Box
          className="box"
          p={4}
          boxShadow={3}
          borderRadius={2}
          bgcolor="background.paper"
        >
          {localError && (
            <Typography color="error" sx={{ wordWrap: "break-word", mb: 2 }}>
              {localError}
            </Typography>
          )}
          <form onSubmit={handleLogin}>
            <Typography variant="h5" mb={2} textAlign="center">
              Login
            </Typography>
            <TextField
              fullWidth
              label="Email / Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              margin="normal"
            />
            <Divider sx={{ my: 3 }} />
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="contained" type="submit" disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} /> : "Login"}
              </Button>
              <Button
                component={RouterLink}
                to="/register/default"
                variant="outlined"
              >
                Register
              </Button>
              <Button
                component={RouterLink}
                to="/password-reset"
                variant="outlined"
              >
                Forgot Password?
              </Button>
            </Stack>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
