import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Uses localStorage by default
import loginSlice from './slices/loginSlice';
import themeSlice from './slices/themeSlice';

// Persist configuration
const persistConfig = {
    key: 'agent_root',  // Root key for persisted data
    storage,       // Storage engine (localStorage or AsyncStorage for React Native)
};

// Root reducer
const rootReducer = combineReducers({
    login: loginSlice,
    theme:  themeSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store with persisted reducers
const store = configureStore({
    reducer: persistedReducer,
    // redux-persist's own actions carry functions; skip them in the serializable check
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // redux-persist actions include register/rehydrate/result callbacks
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
                ignoredActionPaths: ["register", "rehydrate", "result", "meta.arg", "payload.timestamp"],
            },
        }),
});

// Create a persistor to persist the store
const persistor = persistStore(store);

export { store, persistor };
