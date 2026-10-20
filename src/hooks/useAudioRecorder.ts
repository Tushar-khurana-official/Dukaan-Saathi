import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioRecordingResult {
  blob: Blob;
  base64: string;
  duration: number;
  mimeType: string;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 40, 20, 10]);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Setup Web Speech API fallback if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN'; // Default to Hindi / Indian English

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setSpeechTranscript(currentTranscript.trim());
        };

        speechRecognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech recognition setup warning:', e);
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setSpeechTranscript('');
      setRecordingDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analysis for live waveform
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);

      // Duration timer
      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 500);

      // Live waveform visualizer
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Pick 5-7 sample bands
        const bands = [
          Math.max(10, Math.min(95, Math.round((dataArray[1] / 255) * 100))),
          Math.max(15, Math.min(100, Math.round((dataArray[3] / 255) * 100))),
          Math.max(20, Math.min(100, Math.round((dataArray[6] / 255) * 100))),
          Math.max(15, Math.min(90, Math.round((dataArray[9] / 255) * 100))),
          Math.max(10, Math.min(80, Math.round((dataArray[12] / 255) * 100))),
        ];
        setAudioLevels(bands);

        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      // Start speech recognition if present
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.start();
        } catch {
          // Ignore if already active
        }
      }
    } catch (err) {
      console.error('Failed to start microphone:', err);
      setIsRecording(false);
      throw err;
    }
  }, []);

  const stopRecording = useCallback((): Promise<AudioRecordingResult> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        reject(new Error('Recorder not initialized'));
        return;
      }

      recorder.onstop = async () => {
        // Cleanup streams & visualizers
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {}
        }

        setIsRecording(false);

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          resolve({
            blob,
            base64,
            duration: recordingDuration,
            mimeType,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      recorder.stop();
    });
  }, [recordingDuration]);

  const cancelRecording = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  }, []);

  return {
    isRecording,
    recordingDuration,
    audioLevels,
    speechTranscript,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
