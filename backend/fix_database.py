#!/usr/bin/env python3
"""
Database Fix Script
This script recreates the database tables to include the new fields we added.
"""

import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.db.base import Base
from app.models.consultation import Consultation, MedicalReport, RadiologyAnalysis
from app.models.user import User

def fix_database():
    """Recreate all database tables with the new schema."""
    print("🔄 Recreating database tables...")
    
    try:
        # Drop all existing tables
        print("📋 Dropping existing tables...")
        Base.metadata.drop_all(bind=engine)
        
        # Create all tables with new schema
        print("🏗️  Creating new tables...")
        Base.metadata.create_all(bind=engine)
        
        print("✅ Database tables recreated successfully!")
        print("📝 Note: All existing data has been cleared.")
        print("🔧 You'll need to recreate your test data.")
        
    except Exception as e:
        print(f"❌ Error recreating database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔧 Database Fix Script")
    print("=" * 40)
    
    response = input("⚠️  This will DELETE ALL EXISTING DATA. Continue? (y/N): ")
    
    if response.lower() in ['y', 'yes']:
        if fix_database():
            print("\n🎉 Database fixed successfully!")
            print("🚀 You can now restart your backend server.")
        else:
            print("\n💥 Failed to fix database.")
    else:
        print("❌ Operation cancelled.") 