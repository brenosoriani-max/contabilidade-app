import axios, { AxiosError } from 'axios';
import { mutate } from 'swr';
import type { ApiResponse } from '@/types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.response.use((response) => {
  const method = response.config.method?.toLowerCase();

  if (method && MUTATION_METHODS.has(method)) {
    void mutate(() => true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('api:mutation', {
          detail: {
            method,
            url: response.config.url,
          },
        })
      );
    }
  }

  return response;
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
