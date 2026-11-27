import axios from 'axios';
import React from 'react'
import { ErrorToast } from './utils/Toaster';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store, persistor } from './redux/store';
import Index from './routes/Index';
import { PersistGate } from 'redux-persist/integration/react';
import "rsuite/dist/rsuite.min.css";
import "react-quill/dist/quill.core.css";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import AppLoader from './components/AppLoader';
import { clearSession } from "@/utils/product";

const queryClient = new QueryClient({
  // defaultOptions: {
  //   queries: {
  //     staleTime: 30 * 1000, // 1/2 minute
  //   },
  // },
})
const App = () => {

  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      const returnValue = {
        success: false,
        message: ""
      }
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Check for 401 Unauthorized
          if (error.response.status === 401) {
            returnValue.message = error.response.data?.message || "Unauthorized access";
            setTimeout(() => {
              window.location.href = '/';
              clearSession()
              persistor.purge();
            }, 1000);
          } else {
            returnValue.message = error.response.data?.message || "Request failed";
          }
        } else if (error.request) {
          returnValue.message = "No response from server";
        } else {
          returnValue.message = error.message;
        }
      } else {
        returnValue.message = "An unexpected error occurred";
      }
      ErrorToast(returnValue.message);
      return error
    })
  return (
    <Provider store={store}>
      <PersistGate
        loading={<AppLoader label="Starting" />}
        persistor={persistor}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Index />
            <Toaster />
          </BrowserRouter>
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  )
}

export default App