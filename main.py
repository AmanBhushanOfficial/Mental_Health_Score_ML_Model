"""
MindMetrics – Mental Health Score API + website

Run (from THIS folder):
    uvicorn main:app --port 2200 --reload

Then open:  http://127.0.0.1:2200      (website)
            http://127.0.0.1:2200/docs (API docs)
"""
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
model = joblib.load(BASE_DIR / "Mental_Health_Model.pkl")

top_countries = ['Other', 'India', 'USA', 'Canada', 'Australia', 'UK',
                 'Germany', 'Mexico', 'Turkey', 'France']

app = FastAPI(title="MindMetrics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Input validation ----------
class StudentData(BaseModel):
    Age: int = Field(..., ge=10, le=100)
    gender: Literal['Male', 'Female']
    country: str
    academic_level: Literal['Undergraduate', 'Graduate', 'High School']
    most_used_platform: Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat',
                                'Twitter', 'YouTube', 'TikTok', 'LINE',
                                'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat']
    purpose_of_use: Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours: float = Field(..., ge=0, le=24)
    daily_unlocks: int = Field(..., ge=0)
    study_hours: float = Field(..., ge=0, le=24)
    physical_activity_hours: float = Field(..., ge=0, le=24)
    sleep_hours_per_night: float = Field(..., ge=0, le=24)
    stress_level: Literal['Low', 'Medium', 'High', 'Very High']


# ---------- Output ----------
class PredictionResponse(BaseModel):
    predicted_mental_health_score: float


# ---------- Website (served from the same port, so no CORS/port clashes) ----------
@app.get("/", include_in_schema=False)
def home():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/style.css", include_in_schema=False)
def css():
    return FileResponse(BASE_DIR / "style.css", media_type="text/css")


@app.get("/script.js", include_in_schema=False)
def js():
    return FileResponse(BASE_DIR / "script.js", media_type="application/javascript")


@app.get("/health")
def health():
    return {"status": "ok", "message": "Welcome to Achivant"}


# ---------- Prediction ----------
@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    country_group = data.country if data.country in top_countries else "Other"

    row = {
        'Age': data.Age,
        'Gender': data.gender,
        'Academic_Level': data.academic_level,
        'Most_Used_Platform': data.most_used_platform,
        'Purpose_Of_Use': data.purpose_of_use,
        'Avg_Daily_Usage_Hours': data.avg_daily_usage_hours,
        'Daily_Unlocks': data.daily_unlocks,
        'Study_Hours': data.study_hours,
        'Physical_Activity_Hours': data.physical_activity_hours,
        'Sleep_Hours_Per_Night': data.sleep_hours_per_night,
        'Stress_Level': data.stress_level,
        'Grouped_countries': country_group,   # the model uses this, not raw 'Country'
    }

    # Use exactly the columns (and order) the model was trained on
    cols = list(getattr(model, "feature_names_in_", row.keys()))
    input_row = pd.DataFrame([row])[cols]

    try:
        prediction = model.predict(input_row)[0]
    except Exception as e:  # shows the real reason in the browser instead of a vague network error
        raise HTTPException(status_code=500, detail=f"Model error: {e}")

    return PredictionResponse(predicted_mental_health_score=round(float(prediction), 2))
