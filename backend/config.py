"""Application configuration."""
import os

class Config:
    """Base configuration."""
    # Allow multiple comma-separated keys for load balancing
    _keys_str = os.environ.get("GEMINI_API_KEYS", os.environ.get("GEMINI_API_KEY", ""))
    GEMINI_KEYS = [k.strip() for k in _keys_str.split(",") if k.strip()]
    
    GEMINI_MODEL = "gemini-2.5-flash"
    MAX_RETRIES = 3  # Retry count for JSON validation failures
    TEMP_DIR = os.path.join(os.path.dirname(__file__), "tmp")
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    @staticmethod
    def init_app():
        """Initialize app config and validate environment."""
        os.makedirs(Config.TEMP_DIR, exist_ok=True)

        # Ensure at least one Gemini API key is present
        if not Config.GEMINI_KEYS:
            raise ValueError("No Gemini API keys found. Please set GEMINI_API_KEYS in .env")
