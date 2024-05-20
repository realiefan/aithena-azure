import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FaMicrophone, FaMicrophoneAltSlash } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

const ChatBot = () => {
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [genAI, setGenAI] = useState(null);
  const [model, setModel] = useState(null);

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  useEffect(() => {
    const initializeGenAI = async () => {
      const genAIInstance = new GoogleGenerativeAI(
        import.meta.env.VITE_API_KEY
      );
      const modelInstance = await genAIInstance.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        generationConfig,
        systemInstruction:
          "I'm a voice assistant created by Irfan. I'll provide helpful, concise answers, aiming for under 5 lines.",
      });

      setGenAI(genAIInstance);
      setModel(modelInstance);
    };

    initializeGenAI();
  }, []);

  useEffect(() => {
    if (!genAI || !model) return;

    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = () => setIsProcessing(false);

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [genAI, model]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  const handleResult = async (event) => {
    const transcript = event.results[0][0].transcript.trim();

    console.log("Recognized speech:", transcript);

    setHistory((prevHistory) => [
      ...prevHistory,
      { role: "user", parts: transcript },
    ]);

    setIsProcessing(true);

    try {
      const chat = await model.startChat();
      const result = await chat.sendMessageStream(transcript);
      const response = await result.response;
      const text = await response.text();

      setHistory((prevHistory) => [
        ...prevHistory,
        { role: "model", parts: text },
      ]);

      speakResponse(markdownToPlainText(text));
    } catch (error) {
      console.error("Error processing response:", error);
      setSpeechError(error.message);
      setIsProcessing(false);
    }
  };

  const handleError = (event) => {
    console.error("Speech recognition error:", event.error);
    setSpeechError(event.error);
    setIsProcessing(false);
  };

  const speakResponse = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.2;
    utterance.pitch = 1;
    utterance.voice = synthRef.current
      .getVoices()
      .find((voice) => voice.name === "Google UK English Female");

    utterance.onend = () => {
      setIsProcessing(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const markdownToPlainText = (markdown) => {
    const div = document.createElement("div");
    div.innerHTML = markdown;
    return div.textContent || div.innerText || "";
  };

  const toggleSpeechRecognition = () => {
    synthRef.current.cancel();
    if (isProcessing) {
      recognitionRef.current.stop();
      if (utteranceRef.current) {
        synthRef.current.cancel();
      }
      setIsProcessing(false);
    } else {
      recognitionRef.current.start();
      setIsProcessing(true);
    }
  };

  const stopSpeech = () => {
    synthRef.current.cancel();
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-svh bg-black text-white p-4">
      <div
        className="flex flex-col w-full h-[70vh] overflow-y-auto mb-4 p-2 rounded"
        ref={chatContainerRef}
      >
        {history.map((item, index) => (
          <div
            key={index}
            className={
              item.role === "user" ? "text-right mb-2" : "text-left mb-2"
            }
          >
            {item.role === "user" ? (
              <span className="prose font-semibold text-blue-400">
                {item.parts}
              </span>
            ) : (
              <ReactMarkdown className="prose font-semibold prose-invert">
                {item.parts}
              </ReactMarkdown>
            )}
          </div>
        ))}
      </div>
      <div className="relative flex items-center justify-center w-full h-20">
        <motion.button
          onClick={toggleSpeechRecognition}
          className={`flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition ${
            isProcessing ? "bg-red-600 pulse" : "bg-blue-600"
          }`}
          whileTap={{ scale: 0.9 }}
        >
          {isProcessing ? (
            <FaMicrophoneAltSlash className="text-3xl text-white" />
          ) : (
            <FaMicrophone className="text-3xl text-white" />
          )}
        </motion.button>
        {isProcessing && (
          <motion.div
            className="absolute w-20 h-20 rounded-full border-4 border-blue-300 animate-ping"
            onClick={stopSpeech}
          ></motion.div>
        )}
      </div>
    </div>
  );
};

export default ChatBot;