import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '@/types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>) {
  try {
    const response = await request;
    if (!response.data.success) {
      throw new Error(response.data.error);
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const data = error.response?.data as ApiResponse<never> | undefined;
      if (data && !data.success) {
        throw new Error(data.error);
      }
    }

    throw error;
  }
}
