import dotenv from 'dotenv';
import sequelize from '../config/dbconfig';

dotenv.config();

const syncDatabase = async () => {
  try {
    console.log('🔄 Starting database sync...');
    
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Initialize models and associations
    const ModelInitializer = (await import('../config/modelInitializer')).default;
    const initializer = ModelInitializer.getInstance();
    
    // Reset initialization state to ensure sync runs (if already initialized)
    if (initializer.isModelInitialized()) {
      // Use reinitialize which resets state and calls initializeModels
      const syncOptions = {
        // add / widen columns, but never DROP a column that left a model (that would delete data)
        alter: process.env.NODE_ENV !== 'production' ? { drop: false } : false,
        force: false
      };
      console.log(`📊 Sync options:`, syncOptions);
      await initializer.reinitialize(syncOptions);
    } else {
      // First time initialization
      const syncOptions = {
        // add / widen columns, but never DROP a column that left a model (that would delete data)
        alter: process.env.NODE_ENV !== 'production' ? { drop: false } : false,
        force: false
      };
      console.log(`📊 Sync options:`, syncOptions);
      await initializer.initializeModels(syncOptions);
    }
    
    console.log('✅ Database sync completed successfully');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    await sequelize.close();
    process.exit(1);
  }
};

syncDatabase();

