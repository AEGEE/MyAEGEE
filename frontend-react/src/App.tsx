import { Outlet } from '@tanstack/react-router';
import { Box, Typography } from '@mui/material';

export default function App() {
  return (
    <Box p={4}>
      <Typography variant="h4" mb={4}>My App</Typography>
      <Outlet />
    </Box>
  );
}
