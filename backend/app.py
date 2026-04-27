"""
LabCraft — Flask application entry point.
"""
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load .env BEFORE importing Config, since Config reads env vars at class-definition time
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS — configurable via env, defaults to allow all
    cors_origins = os.environ.get("CORS_ORIGINS", "*")
    if cors_origins != "*":
        origins = [o.strip() for o in cors_origins.split(",")]
    else:
        origins = "*"
    CORS(app, origins=origins)

    # Init config
    Config.init_app()

    # Register blueprints
    from routes.experiment import experiment_bp
    from routes.ppt import ppt_bp
    from routes.download import download_bp

    app.register_blueprint(experiment_bp, url_prefix="/api")
    app.register_blueprint(ppt_bp, url_prefix="/api")
    app.register_blueprint(download_bp, url_prefix="/api")

    # Health check
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "app": "LabCraft"})

    # Error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Too many requests. Please try again later."}), 429

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


# Module-level app instance for gunicorn (gunicorn app:app)
app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)

