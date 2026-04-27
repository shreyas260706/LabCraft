"""
Download routes — generate and return downloadable files (PDF, DOCX, PPTX).
"""
from flask import Blueprint, request, jsonify, send_file
from utils.pdf_generator import generate_experiment_pdf
from utils.docx_generator import generate_experiment_docx
from utils.pptx_generator import generate_ppt_file

download_bp = Blueprint("download", __name__)


@download_bp.route("/download-experiment", methods=["POST"])
def download_experiment():
    """Generate and return experiment in PDF or DOCX format."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    experiment = data.get("experiment")
    fmt = data.get("format", "pdf").lower()

    if not experiment:
        return jsonify({"error": "experiment data is required"}), 400

    exp_no = experiment.get("experiment_no", "0")

    try:
        if fmt == "pdf":
            buffer = generate_experiment_pdf(experiment)
            return send_file(
                buffer,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=f"Experiment_{exp_no}.pdf",
            )
        elif fmt == "docx":
            buffer = generate_experiment_docx(experiment)
            return send_file(
                buffer,
                mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                as_attachment=True,
                download_name=f"Experiment_{exp_no}.docx",
            )
        else:
            return jsonify({"error": "Invalid format. Use 'pdf' or 'docx'"}), 400
    except Exception as e:
        return jsonify({"error": f"Download failed: {str(e)}"}), 500


@download_bp.route("/download-ppt", methods=["POST"])
def download_ppt():
    """Generate and return a PPTX file."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    ppt_data = data.get("ppt_data")
    if not ppt_data:
        return jsonify({"error": "ppt_data is required"}), 400

    title = ppt_data.get("title", "Presentation")

    try:
        buffer = generate_ppt_file(ppt_data)
        safe_title = "".join(c for c in title if c.isalnum() or c in " _-")[:50]
        return send_file(
            buffer,
            mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            as_attachment=True,
            download_name=f"{safe_title}.pptx",
        )
    except Exception as e:
        return jsonify({"error": f"PPT download failed: {str(e)}"}), 500
