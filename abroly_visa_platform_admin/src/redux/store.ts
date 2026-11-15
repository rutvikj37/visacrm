import { combineReducers, configureStore } from '@reduxjs/toolkit';
import loginSlice from './slices/loginSlice';
import themeSlice from './slices/themeSlice';
import storage from 'redux-persist/lib/storage';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';

const rootReducer = combineReducers({
    login: loginSlice,
    theme:themeSlice
});


const persistConfig = {
    key: 'admnin_root', 
    storage, // Uses localStorage
};

// Apply persistReducer to the combined root reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

const persistor = persistStore(store);

export { store, persistor };
