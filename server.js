// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Generative AI (Gemini)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate-plan', async (req, res) => {
  try {
    const { 
      subjectName, 
      examDate, 
      examTime, 
      daysUntilExam, 
      additionalInfo,
      studyPreference 
    } = req.body;

    // Validate input
    if (!subjectName || !examDate || !examTime || !daysUntilExam) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create prompts for different parts of the response
    const syllabusPrompt = createSyllabusPrompt(subjectName, additionalInfo);
    const schedulePrompt = createSchedulePrompt(
      subjectName, 
      daysUntilExam, 
      examTime, 
      additionalInfo,
      studyPreference
    );
    const mcqPrompt = createMCQPrompt(subjectName, additionalInfo);

    // Get model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Generate syllabus content
    const syllabusResponse = await model.generateContent(syllabusPrompt);
    const syllabusContent = syllabusResponse.response.text();

    // Generate schedule content
    const scheduleResponse = await model.generateContent(schedulePrompt);
    const scheduleContent = scheduleResponse.response.text();

    // Generate MCQ questions
    const mcqResponse = await model.generateContent(mcqPrompt);
    const mcqText = mcqResponse.response.text();
    const mcqQuestions = parseMCQQuestions(mcqText);

    // Send response
    res.json({
      syllabus: syllabusContent,
      schedule: scheduleContent,
      mcqQuestions
    });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate study plan' });
  }
});

// Add this to server.js
app.post('/generate-mcqs', async (req, res) => {
    try {
      const { subjectName, additionalInfo } = req.body;
  
      // Validate input
      if (!subjectName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      // Create prompt specifically for technical MCQs
      const mcqPrompt = `
        Create exactly 10 technical multiple-choice questions (MCQs) specifically about the subject "${subjectName}".
        ${additionalInfo ? `Use this additional context about the subject: ${additionalInfo}` : ''}
        
        The questions must be very specific to "${subjectName}" - technical and subject-related, not general study skills.
        Cover different important technical concepts and aspects of ${subjectName}.
        
        Format your response as a valid JSON array with exactly this structure:
        [
          {
            "question": "Technical question about ${subjectName}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0
          },
          ... 9 more questions ...
        ]
        
        Ensure you provide exactly 10 questions in this JSON format.
        The correctAnswer should be a number (0 for A, 1 for B, 2 for C, 3 for D).
        Do not include any explanations or text outside the JSON array.
      `;
  
      // Get model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
      // Generate MCQ questions with special handling
      const mcqResponse = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: mcqPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          topP: 0.95,
          topK: 40
        }
      });
      
      const mcqText = mcqResponse.response.text();
      const mcqQuestions = parseMCQQuestions(mcqText);
  
      // Send response
      res.json({
        mcqQuestions: mcqQuestions.slice(0, 10)
      });
    } catch (error) {
      console.error('Error generating MCQs:', error);
      res.status(500).json({ error: 'Failed to generate MCQ questions' });
    }
  });
// Helper functions
function createSyllabusPrompt(subject, additionalInfo) {
  return `
    Create a comprehensive syllabus breakdown for the subject "${subject}". 
    ${additionalInfo ? `Additional context about the subject: ${additionalInfo}` : ''}
    
    Provide a complete syllabus with main topics and subtopics that should be covered for an exam on this subject.
    Format your response in markdown with proper headings, bullet points, and sections.
    Organize the content in a logical sequence for learning.
    Include approximately 5-8 main topics with relevant subtopics under each.
  `;
}

function createSchedulePrompt(subject, daysUntilExam, examTime, additionalInfo, studyPreference) {
  return `
    Create a detailed daily study schedule for preparing for a "${subject}" exam that is ${daysUntilExam} days away.
    The exam will take place at ${examTime}.
    ${additionalInfo ? `Additional context about the subject: ${additionalInfo}` : ''}
    Study time preference: ${studyPreference}
    
    Create a day-by-day schedule with specific hourly breakdowns of what topics to study.
    Each day should have a balanced mix of learning new material, reviewing previous material, and practice/self-testing.
    Account for the fact that some topics are more complex and require more time.
    Include short breaks and suggest review techniques.
    Format your response in markdown with clear daily headings and structured hourly schedules.
    Adapt the schedule to the study preference provided (${studyPreference}).
    Include specific recommendations for the day before the exam.
  `;
}

function createMCQPrompt(subject, additionalInfo) {
    return `
      Create exactly 10 technical multiple-choice questions (MCQs) specifically about the subject "${subject}".
      ${additionalInfo ? `Use this additional context about the subject: ${additionalInfo}` : ''}
      
      The questions should be detailed, technical, and specifically related to the "${subject}" content.
      Cover different important concepts and aspects of ${subject}.
      Vary the difficulty level with some easier and some challenging questions.
      
      Format your response as a valid JSON array with exactly this structure:
      [
        {
          "question": "Technical question about ${subject}?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0
        },
        ... 9 more questions ...
      ]
      
      Ensure you provide exactly 10 questions in this format.
      The correctAnswer should be a number (0 for A, 1 for B, 2 for C, 3 for D).
      Do not include any explanations or additional text outside the JSON array.
    `;
  }

function parseMCQQuestions(mcqText) {
    try {
      // First, try to extract any JSON array from the text
      const jsonRegex = /\[\s*\{\s*"question"[\s\S]*\}\s*\]/;
      const match = mcqText.match(jsonRegex);
      
      if (match) {
        const parsedQuestions = JSON.parse(match[0]);
        // Ensure we have exactly 10 questions
        if (parsedQuestions.length >= 10) {
          return parsedQuestions.slice(0, 10);
        }
      }
      
      // If no valid JSON array with enough questions was found, let's parse it manually
      const questions = [];
      const questionRegex = /(?:^|\n)(?:\d+\.\s*)([^?]+\?)/g;
      const questionMatches = [...mcqText.matchAll(questionRegex)];
      
      for (let i = 0; i < questionMatches.length && questions.length < 10; i++) {
        const questionText = questionMatches[i][1].trim();
        const optionsText = mcqText.split(questionText)[1]?.split(/(?:\d+\.\s*)|(?:\n\s*\n)/)[0];
        
        if (optionsText) {
          const options = [];
          const optionRegex = /(?:^|\n)(?:[A-D]\.\s*)(.+?)(?=\n[A-D]\.|$)/g;
          const optionMatches = [...optionsText.matchAll(optionRegex)];
          
          for (const optionMatch of optionMatches) {
            options.push(optionMatch[1].trim());
          }
          
          // Find correct answer
          let correctAnswer = 0;
          if (optionsText.includes("Correct: A") || optionsText.includes("correct: A") || 
              optionsText.match(/correct(?:\s*answer)?(?:\s*is)?(?:\s*:)?\s*A/i)) {
            correctAnswer = 0;
          } else if (optionsText.includes("Correct: B") || optionsText.includes("correct: B") || 
                     optionsText.match(/correct(?:\s*answer)?(?:\s*is)?(?:\s*:)?\s*B/i)) {
            correctAnswer = 1;
          } else if (optionsText.includes("Correct: C") || optionsText.includes("correct: C") || 
                     optionsText.match(/correct(?:\s*answer)?(?:\s*is)?(?:\s*:)?\s*C/i)) {
            correctAnswer = 2;
          } else if (optionsText.includes("Correct: D") || optionsText.includes("correct: D") || 
                     optionsText.match(/correct(?:\s*answer)?(?:\s*is)?(?:\s*:)?\s*D/i)) {
            correctAnswer = 3;
          }
          
          if (options.length >= 4) {
            questions.push({
              question: questionText,
              options: options.slice(0, 4),
              correctAnswer
            });
          }
        }
      }
      
      if (questions.length >= 5) {
        return questions.slice(0, 10);
      }
      
      // If we still couldn't get enough questions, make another attempt with a different approach
      return createFallbackQuestionsFromText(mcqText, 10);
      
    } catch (error) {
      console.error('Error parsing MCQ response:', error);
      return createFallbackQuestionsFromText(mcqText, 10);
    }
  }
  
  function createFallbackQuestionsFromText(text, count) {
    const questions = [];
    
    // Try to extract question-like sentences
    const sentences = text.split(/[.?!]\s+/);
    let questionIndex = 0;
    
    for (let i = 0; i < sentences.length && questionIndex < count; i++) {
      const sentence = sentences[i].trim();
      
      // Only look at sentences that appear to be questions
      if (sentence.includes('?') || sentence.length > 30) {
        // Create plausible options from elsewhere in the text
        const options = [];
        const wordsToAvoid = new Set(sentence.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase()));
        
        // Generate options from other sentences
        for (let j = 0; j < sentences.length && options.length < 3; j++) {
          if (i !== j && sentences[j].length > 15) {
            const words = sentences[j].split(/\s+/);
            for (let k = 0; k < words.length; k++) {
              if (words[k].length > 4 && !wordsToAvoid.has(words[k].toLowerCase())) {
                const startIdx = Math.max(0, k - 2);
                const endIdx = Math.min(words.length, k + 3);
                const option = words.slice(startIdx, endIdx).join(' ').replace(/[,.?!:;]$/, '');
                
                if (option.length > 5 && !options.includes(option)) {
                  options.push(option);
                  break;
                }
              }
            }
          }
        }
        
        // Add one more option if needed
        while (options.length < 3) {
          options.push(`Option ${options.length + 1}`);
        }
        
        // Add the correct answer
        const correctPhrases = sentence.match(/\b\w{4,}\b/g) || [];
        let correctOption = correctPhrases.length > 0 
          ? correctPhrases[Math.floor(Math.random() * correctPhrases.length)] 
          : "Correct option";
        
        options.splice(Math.floor(Math.random() * 4), 0, correctOption);
        
        questions.push({
          question: sentence.endsWith('?') ? sentence : `${sentence}?`,
          options: options.slice(0, 4),
          correctAnswer: options.indexOf(correctOption)
        });
        
        questionIndex++;
      }
    }
    
    // If we still don't have enough questions, create generic ones related to the text
    while (questions.length < count) {
      const idx = questions.length;
      questions.push({
        question: `Question ${idx + 1} related to the subject?`,
        options: [
          "First possible answer",
          "Second possible answer",
          "Third possible answer",
          "Fourth possible answer"
        ],
        correctAnswer: Math.floor(Math.random() * 4)
      });
    }
    
    return questions.slice(0, count);
  }
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});