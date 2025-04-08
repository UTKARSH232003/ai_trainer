const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    if (!subjectName || !examDate || !examTime || !daysUntilExam) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const syllabusPrompt = createSyllabusPrompt(subjectName, additionalInfo);
    const schedulePrompt = createSchedulePrompt(
      subjectName, 
      daysUntilExam, 
      examTime, 
      additionalInfo,
      studyPreference
    );
    const mcqPrompt = createMCQPrompt(subjectName, additionalInfo);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const syllabusResponse = await model.generateContent(syllabusPrompt);
    const syllabusContent = syllabusResponse.response.text();

    const scheduleResponse = await model.generateContent(schedulePrompt);
    const scheduleContent = scheduleResponse.response.text();

    const mcqResponse = await model.generateContent(mcqPrompt);
    const mcqText = mcqResponse.response.text();
    const mcqQuestions = parseMCQQuestions(mcqText);

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

app.post('/generate-mcqs', async (req, res) => {
    try {
      const { subjectName, additionalInfo } = req.body;
  
      if (!subjectName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
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
  
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
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
  
      res.json({
        mcqQuestions: mcqQuestions.slice(0, 10)
      });
    } catch (error) {
      console.error('Error generating MCQs:', error);
      res.status(500).json({ error: 'Failed to generate MCQ questions' });
    }
  });
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
function createDefaultDayCard() {
  const dayCard = document.createElement('div');
  dayCard.className = 'bg-white rounded-lg shadow-md border-l-4 border-indigo-500';
  
  const dayHeader = document.createElement('div');
  dayHeader.className = 'bg-gray-50 px-4 py-3 rounded-t-lg border-b border-gray-200';
  
  const dayTitle = document.createElement('h3');
  dayTitle.className = 'text-xl font-semibold text-indigo-700';
  dayTitle.textContent = 'Study Day';
  dayHeader.appendChild(dayTitle);
  
  dayCard.appendChild(dayHeader);
  
  const dayContent = document.createElement('div');
  dayContent.className = 'p-4';
  dayCard.appendChild(dayContent);
  
  const timeBlocks = document.createElement('div');
  timeBlocks.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
  
  const morningSection = document.createElement('div');
  morningSection.className = 'bg-blue-50 rounded-lg p-3';
  
  const morningHeader = document.createElement('h4');
  morningHeader.className = 'font-medium text-blue-800 border-b border-blue-100 pb-2 mb-2 flex items-center';
  morningHeader.innerHTML = '<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z"></path></svg>Morning';
  morningSection.appendChild(morningHeader);
  
  const morningContent = document.createElement('div');
  morningContent.className = 'morning-content text-sm space-y-2';
  morningSection.appendChild(morningContent);
  
  const afternoonSection = document.createElement('div');
  afternoonSection.className = 'bg-yellow-50 rounded-lg p-3';
  
  const afternoonHeader = document.createElement('h4');
  afternoonHeader.className = 'font-medium text-yellow-800 border-b border-yellow-100 pb-2 mb-2 flex items-center';
  afternoonHeader.innerHTML = '<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16z"></path></svg>Afternoon';
  afternoonSection.appendChild(afternoonHeader);
  
  const afternoonContent = document.createElement('div');
  afternoonContent.className = 'afternoon-content text-sm space-y-2';
  afternoonSection.appendChild(afternoonContent);
  
  const eveningSection = document.createElement('div');
  eveningSection.className = 'bg-purple-50 rounded-lg p-3';
  
  const eveningHeader = document.createElement('h4');
  eveningHeader.className = 'font-medium text-purple-800 border-b border-purple-100 pb-2 mb-2 flex items-center';
  eveningHeader.innerHTML = '<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>Evening';
  eveningSection.appendChild(eveningHeader);
  
  const eveningContent = document.createElement('div');
  eveningContent.className = 'evening-content text-sm space-y-2';
  eveningSection.appendChild(eveningContent);
  
  timeBlocks.appendChild(morningSection);
  timeBlocks.appendChild(afternoonSection);
  timeBlocks.appendChild(eveningSection);
  
  dayContent.appendChild(timeBlocks);
  
  return dayCard;
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
      const jsonRegex = /\[\s*\{\s*"question"[\s\S]*\}\s*\]/;
      const match = mcqText.match(jsonRegex);
      
      if (match) {
        const parsedQuestions = JSON.parse(match[0]);
        if (parsedQuestions.length >= 10) {
          return parsedQuestions.slice(0, 10);
        }
      }
      
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
      
      return createFallbackQuestionsFromText(mcqText, 10);
      
    } catch (error) {
      console.error('Error parsing MCQ response:', error);
      return createFallbackQuestionsFromText(mcqText, 10);
    }
  }
  
  function createFallbackQuestionsFromText(text, count) {
    const questions = [];
    
    const sentences = text.split(/[.?!]\s+/);
    let questionIndex = 0;
    
    for (let i = 0; i < sentences.length && questionIndex < count; i++) {
      const sentence = sentences[i].trim();
      
      if (sentence.includes('?') || sentence.length > 30) {
        // Create plausible options from elsewhere in the text
        const options = [];
        const wordsToAvoid = new Set(sentence.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase()));
        
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
        
        while (options.length < 3) {
          options.push(`Option ${options.length + 1}`);
        }
        
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});