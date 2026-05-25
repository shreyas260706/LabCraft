"""
Experiment routes — generate, modify experiments.
"""
import json
import os
from flask import Blueprint, request, jsonify
from services.ai_service import generate_experiment, modify_section, is_experiment_cached
from utils.rate_limiter import check_generate_limit, increment_generate, check_modify_limit, increment_modify

experiment_bp = Blueprint("experiment", __name__)

# Load courses data
_data_path = os.path.join(os.path.dirname(__file__), "..", "data", "courses.json")
with open(_data_path, "r") as f:
    _courses_data = json.load(f)


@experiment_bp.route("/courses", methods=["GET"])
def get_courses():
    """Return the course → semester → subject tree."""
    return jsonify(_courses_data)


@experiment_bp.route("/generate-experiment", methods=["POST"])
def generate_experiment_route():
    """Generate a complete lab experiment."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    subject = data.get("subject")
    experiment_no = data.get("experiment_no")
    topic = data.get("topic")
    aim = data.get("aim")  # Optional
    options = data.get("options", {})  # Generation toggles

    if not all([subject, experiment_no, topic]):
        return jsonify({"error": "subject, experiment_no, and topic are required"}), 400

    try:
        experiment_no = int(experiment_no)
    except (ValueError, TypeError):
        return jsonify({"error": "experiment_no must be a number"}), 400

    ip = request.remote_addr
    force_refresh = data.get("force_refresh", False)

    # Rate limit check — skip if result is already cached (no API call needed)
    if force_refresh or not is_experiment_cached(subject, topic, options):
        limit_error = check_generate_limit(ip)
        if limit_error:
            return jsonify({"error": limit_error}), 429

    try:
        result = generate_experiment(subject, experiment_no, topic, aim, options, force_refresh)

        # Only count towards limit if it was an actual API call (not a cache hit)
        if not result.get("_cached", False):
            increment_generate(ip)

        # Remove internal flag before sending to client
        result.pop("_cached", None)

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Generation failed: {str(e)}"}), 500


@experiment_bp.route("/modify-section", methods=["POST"])
def modify_section_route():
    """Modify ONLY a specific section of an experiment."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    experiment = data.get("experiment")
    section = data.get("section")
    instruction = data.get("instruction", "Improve this section")

    if not experiment or not section:
        return jsonify({"error": "experiment and section are required"}), 400

    valid_sections = ["aim", "theory", "source_code", "viva", "output"]
    if section not in valid_sections:
        return jsonify({"error": f"Invalid section. Must be one of: {valid_sections}"}), 400

    ip = request.remote_addr

    # Rate limit check for modifications
    limit_error = check_modify_limit(ip)
    if limit_error:
        return jsonify({"error": limit_error}), 429

    try:
        modified_content = modify_section(experiment, section, instruction)
        increment_modify(ip)
        return jsonify({"section": section, "content": modified_content})
    except Exception as e:
        return jsonify({"error": f"Modification failed: {str(e)}"}), 500

