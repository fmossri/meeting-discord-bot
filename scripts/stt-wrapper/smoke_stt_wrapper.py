import requests
import base64

r = requests.get("http://localhost:8000/health")

status_code = r.status_code
print("status code 200 OK" if status_code == 200 else "status code %s" % status_code)
json_parsed = r.json()
print(json_parsed)

audio_path = "./tests/audio-samples/sample.wav"
with open(audio_path, "rb") as audio_file:
    audio_data = audio_file.read()
    audio_base64 = base64.b64encode(audio_data).decode("ascii") #encodes the audio data to base64

request_data = {
    "meetingId": "1234567890",
    "chunkId": 1,
    "participantId": "1234567890",
    "chunkStartTimeMs": 0,
    "audio": audio_base64
}

r = requests.post("http://localhost:8000/transcribe", json=request_data)


if r.status_code == 200:
    print("status code 200 OK" if status_code == 200 else "status code %s" % status_code)
    json_parsed = r.json()
    print(json_parsed)
else:
    print("status code %s" % r.status_code)
    print(r.text)