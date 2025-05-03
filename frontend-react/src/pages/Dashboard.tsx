import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';

const fetchUserData = async () => {
  const response = await api.get('/api/core/members/me');
  return response.data;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUserData,
    retry: false,
  });

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate({ to: '/login' });
  };

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">Error loading user data</Typography>;

  return (
    <Box>
      <Typography variant="h5">Welcome, {data.data.first_name} {data.data.last_name}!</Typography>
      <Typography>Email: {data.data.email}</Typography>
      <Typography>Username: {data.data.username}</Typography>
      <Button variant="outlined" sx={{ mt: 2 }} onClick={logout}>
        Logout
      </Button>
    </Box>
  );
}
