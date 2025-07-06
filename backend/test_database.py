#!/usr/bin/env python3
"""
Database Test Script
This script tests if the database is working correctly.
"""

import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.db.base import Base
from app.models.consultation import Consultation, MedicalReport
from app.models.user import User

def test_database():
    """Test if the database is working correctly."""
    print("🔍 Testing database connection...")
    
    try:
        # Test if we can query the tables
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # Test User table
        print("👥 Testing User table...")
        users = db.query(User).all()
        print(f"   Found {len(users)} users")
        
        # Test Consultation table
        print("📋 Testing Consultation table...")
        consultations = db.query(Consultation).all()
        print(f"   Found {len(consultations)} consultations")
        
        # Test if new fields exist
        if consultations:
            consultation = consultations[0]
            print("🔍 Testing new fields...")
            print(f"   patient_summary: {hasattr(consultation, 'patient_summary')}")
            print(f"   medications: {hasattr(consultation, 'medications')}")
            print(f"   recommendations: {hasattr(consultation, 'recommendations')}")
            print(f"   follow_up_notes: {hasattr(consultation, 'follow_up_notes')}")
        
        # Test MedicalReport table
        print("📄 Testing MedicalReport table...")
        reports = db.query(MedicalReport).all()
        print(f"   Found {len(reports)} reports")
        
        db.close()
        
        print("✅ Database test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Database Test Script")
    print("=" * 40)
    
    if test_database():
        print("\n🎉 Database is working correctly!")
    else:
        print("\n💥 Database has issues that need to be fixed.") 