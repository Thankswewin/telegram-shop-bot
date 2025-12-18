from flask import Flask, request, jsonify

app = Flask(__name__)

# Store the last extracted data
last_extracted_data = []

@app.route('/voice', methods=['POST'])
def upload_file():
    global last_extracted_data
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Read the contents of the uploaded file
    content = file.read().decode('utf-8').strip()
    lines = content.split('\n')

    for line in lines:
        print(f"Processing line: {line}")
        # Check if line is in the expected format
        if '|' in line:
            parts = line.split('|')
            if len(parts) == 3:
                try:
                    email = parts[0].strip()
                    name = parts[1].strip()
                    phone_number = parts[2].strip()

                    # Save to last_extracted_data in the format email | name | number
                    last_extracted_data.append(f"{email} | {name} | {phone_number}")
                except Exception as e:
                    print(f"Error processing line format: {line}, error: {e}")
            else:
                print(f"Invalid format in line: {line}")
        else:
            # Handle the old format if necessary
            parts = line.split(',')
            if len(parts) >= 3:
                try:
                    name = parts[0].split(':')[1].strip()
                    phone_number = parts[1].split(':')[1].strip()
                    email = parts[2].split(':')[1].strip()

                    # Save to last_extracted_data in the format email | name | number
                    last_extracted_data.append(f"{email} | {name} | {phone_number}")
                except (IndexError, ValueError) as e:
                    print(f"Error processing line format: {line}, error: {e}")
            else:
                print(f"Invalid format in line: {line}")

    return jsonify({"message": "File processed successfully", "data": last_extracted_data}), 200

@app.route('/line', methods=['GET'])
def get_lines():
    if not last_extracted_data:
        return jsonify({"message": "No data available"}), 404

    return jsonify({"data": last_extracted_data}), 200

@app.route('/trigger-call', methods=['GET'])
def trigger_call():
    phone = request.args.get('phone')
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    # Simulating call logic
    if phone.endswith('7'):  # Example condition for responding 'No'
        return jsonify({"response_text": "No"})
    
    return jsonify({"response_text": "Yes"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9999)
