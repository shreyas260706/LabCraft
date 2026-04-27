"""
PPT routes — generate PPT content and file.
"""
from flask import Blueprint, request, jsonify
from services.ai_service import generate_ppt_content, is_ppt_cached
from utils.pptx_generator import generate_ppt_file
from utils.rate_limiter import check_generate_limit, increment_generate

ppt_bp = Blueprint("ppt", __name__)


@ppt_bp.route("/generate-ppt", methods=["POST"])
def generate_ppt_route():
    """Generate PPT slide content (JSON)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    subject = data.get("subject")
    topic = data.get("topic")

    if not all([subject, topic]):
        return jsonify({"error": "subject and topic are required"}), 400

    ip = request.remote_addr

    # Rate limit check — skip if result is already cached
    if not is_ppt_cached(subject, topic):
        limit_error = check_generate_limit(ip)
        if limit_error:
            return jsonify({"error": limit_error}), 429

    try:
        result = generate_ppt_content(subject, topic)

        # Only count towards limit if it was an actual API call
        if not result.get("_cached", False):
            increment_generate(ip)

        # Remove internal flag before sending to client
        result.pop("_cached", None)

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"PPT generation failed: {str(e)}"}), 500

