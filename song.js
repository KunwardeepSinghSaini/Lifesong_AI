/* Audio-aligned lyric cues in seconds. Fine-tune starts, ends and wordTimes here. */
(function(root){
  const song = {
  "title": "Sunny Side Up",
  "duration": 181.224,
  "artist": "Your sunny-stage anthem",
  "timingStatus": "audio-aligned prototype cues",
  "offset": 0,
  "lines": [
    {
      "section": "Verse 1",
      "text": "Woke up today and the sky is clear",
      "start": 8.94,
      "end": 12.405,
      "targetIndex": 7,
      "wordTimes": [
        8.94,
        9.48,
        9.76,
        10.24,
        10.76,
        10.98,
        11.34,
        11.86
      ]
    },
    {
      "section": "Verse 1",
      "text": "Tossed out the doubt and I shed the fear",
      "start": 12.42,
      "end": 16.585,
      "targetIndex": 8,
      "wordTimes": [
        12.42,
        13.88,
        14.02,
        14.22,
        14.68,
        14.9,
        15.32,
        15.66,
        16.04
      ]
    },
    {
      "section": "Verse 1",
      "text": "Got my feet on the floor, got a skip in my beat",
      "start": 16.6,
      "end": 18.785,
      "targetIndex": 11,
      "wordTimes": [
        16.6,
        16.84,
        17.0,
        17.16,
        17.3,
        17.42,
        17.86,
        17.96,
        18.06,
        18.2,
        18.36,
        18.52
      ]
    },
    {
      "section": "Verse 1",
      "text": "Walking on sunshine right down the street",
      "start": 18.8,
      "end": 20.925,
      "targetIndex": 6,
      "wordTimes": [
        18.8,
        19.34,
        19.56,
        19.8,
        20.18,
        20.44,
        20.62
      ]
    },
    {
      "section": "Verse 1",
      "text": "The coffee is warm and the morning is bright",
      "start": 20.94,
      "end": 23.245,
      "targetIndex": 8,
      "wordTimes": [
        20.94,
        21.3,
        21.5,
        21.72,
        22.04,
        22.26,
        22.38,
        22.56,
        22.82
      ]
    },
    {
      "section": "Verse 1",
      "text": "Everything's turning from gray into light",
      "start": 23.26,
      "end": 25.465,
      "targetIndex": 5,
      "wordTimes": [
        23.26,
        23.94,
        24.16,
        24.46,
        24.68,
        24.88
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Hear that rhythm start to play",
      "start": 25.48,
      "end": 28.485,
      "targetIndex": 5,
      "wordTimes": [
        25.48,
        26.32,
        26.88,
        27.42,
        27.74,
        28.1
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Nothing's gonna stand in my way",
      "start": 28.5,
      "end": 30.665,
      "targetIndex": 5,
      "wordTimes": [
        28.5,
        29.1,
        29.2,
        29.52,
        29.76,
        30.2
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Oh, I feel it in my toes",
      "start": 30.68,
      "end": 32.845,
      "targetIndex": 6,
      "wordTimes": [
        30.68,
        31.18,
        31.28,
        31.7,
        32.02,
        32.2,
        32.44
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Watch how the good mood goes",
      "start": 32.86,
      "end": 34.88,
      "targetIndex": 5,
      "wordTimes": [
        32.86,
        33.32,
        33.48,
        33.62,
        33.76,
        34.06
      ]
    },
    {
      "section": "Chorus",
      "text": "I'm waking up on the sunny side up!",
      "start": 35.54,
      "end": 38.005,
      "targetIndex": 7,
      "wordTimes": [
        35.54,
        36.06,
        36.18,
        36.54,
        36.7,
        36.84,
        37.02,
        37.36
      ]
    },
    {
      "section": "Chorus",
      "text": "Drinking the magic from a loving cup",
      "start": 38.02,
      "end": 40.625,
      "targetIndex": 6,
      "wordTimes": [
        38.02,
        38.2,
        39.36,
        39.7,
        39.92,
        40.06,
        40.32
      ]
    },
    {
      "section": "Chorus",
      "text": "Got a smile so wide that it hurts my face",
      "start": 40.64,
      "end": 43.125,
      "targetIndex": 9,
      "wordTimes": [
        40.64,
        40.98,
        41.08,
        41.22,
        41.54,
        41.88,
        42.08,
        42.22,
        42.38,
        42.6
      ]
    },
    {
      "section": "Chorus",
      "text": "Moving to the rhythm of a happy place",
      "start": 43.14,
      "end": 45.005,
      "targetIndex": 7,
      "wordTimes": [
        43.14,
        43.38,
        43.66,
        43.8,
        44.02,
        44.24,
        44.42,
        44.7
      ]
    },
    {
      "section": "Chorus",
      "text": "Yeah, the world looks good from the sunny side!",
      "start": 45.02,
      "end": 49.565,
      "targetIndex": 8,
      "wordTimes": [
        45.02,
        45.38,
        45.4,
        45.7,
        46.34,
        46.8,
        47.2,
        47.5,
        48.04
      ]
    },
    {
      "section": "Chorus",
      "text": "No looking back, I'm just along for the ride",
      "start": 49.58,
      "end": 54.28,
      "targetIndex": 8,
      "wordTimes": [
        49.58,
        49.6,
        50.28,
        51.16,
        51.32,
        51.56,
        52.52,
        53.58,
        53.86
      ]
    },
    {
      "section": "Verse 2",
      "text": "Saw a little puppy doing funny tricks",
      "start": 61.58,
      "end": 63.845,
      "targetIndex": 6,
      "wordTimes": [
        61.58,
        62.2,
        62.34,
        62.46,
        62.74,
        63.04,
        63.34
      ]
    },
    {
      "section": "Verse 2",
      "text": "Made up my mind that today's gonna stick",
      "start": 63.86,
      "end": 65.945,
      "targetIndex": 7,
      "wordTimes": [
        63.86,
        64.2,
        64.42,
        64.58,
        64.92,
        65.1,
        65.5,
        65.62
      ]
    },
    {
      "section": "Verse 2",
      "text": "Passing out grins to the folks passing by",
      "start": 65.96,
      "end": 68.285,
      "targetIndex": 7,
      "wordTimes": [
        65.96,
        66.48,
        66.76,
        67.04,
        67.22,
        67.34,
        67.56,
        67.84
      ]
    },
    {
      "section": "Verse 2",
      "text": "Catching a breeze underneath a blue sky",
      "start": 68.3,
      "end": 70.385,
      "targetIndex": 6,
      "wordTimes": [
        68.3,
        68.66,
        68.82,
        69.14,
        69.52,
        69.74,
        69.92
      ]
    },
    {
      "section": "Verse 2",
      "text": "Troubles are small like a grain of the sand",
      "start": 70.4,
      "end": 73.825,
      "targetIndex": 8,
      "wordTimes": [
        70.4,
        70.84,
        71.02,
        71.62,
        72.58,
        72.7,
        72.94,
        73.12,
        73.24
      ]
    },
    {
      "section": "Verse 2",
      "text": "Life's playing out like a sweet little band",
      "start": 73.84,
      "end": 78.905,
      "targetIndex": 7,
      "wordTimes": [
        73.84,
        74.92,
        75.18,
        75.98,
        76.8,
        76.96,
        77.18,
        77.52
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Hear that rhythm start to play",
      "start": 78.92,
      "end": 82.045,
      "targetIndex": 5,
      "wordTimes": [
        78.92,
        79.92,
        80.46,
        81.0,
        81.34,
        81.66
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Nothing's gonna stand in my way",
      "start": 82.06,
      "end": 84.205,
      "targetIndex": 5,
      "wordTimes": [
        82.06,
        82.66,
        82.78,
        83.28,
        83.46,
        83.9
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Oh, I feel it in my toes",
      "start": 84.22,
      "end": 86.505,
      "targetIndex": 6,
      "wordTimes": [
        84.22,
        84.76,
        84.84,
        85.22,
        85.6,
        85.74,
        86.0
      ]
    },
    {
      "section": "Pre-Chorus",
      "text": "Watch how the good mood goes",
      "start": 86.52,
      "end": 88.3,
      "targetIndex": 5,
      "wordTimes": [
        86.52,
        86.92,
        87.06,
        87.18,
        87.32,
        87.62
      ]
    },
    {
      "section": "Chorus",
      "text": "I'm waking up on the sunny side up!",
      "start": 89.1,
      "end": 91.505,
      "targetIndex": 7,
      "wordTimes": [
        89.1,
        89.62,
        89.76,
        90.08,
        90.26,
        90.38,
        90.58,
        90.94
      ]
    },
    {
      "section": "Chorus",
      "text": "Drinking the magic from a loving cup",
      "start": 91.52,
      "end": 94.205,
      "targetIndex": 6,
      "wordTimes": [
        91.52,
        92.62,
        92.94,
        93.22,
        93.48,
        93.62,
        93.86
      ]
    },
    {
      "section": "Chorus",
      "text": "Got a smile so wide that it hurts my face",
      "start": 94.22,
      "end": 96.705,
      "targetIndex": 9,
      "wordTimes": [
        94.22,
        94.54,
        94.66,
        94.8,
        95.12,
        95.46,
        95.64,
        95.8,
        95.92,
        96.14
      ]
    },
    {
      "section": "Chorus",
      "text": "Moving to the rhythm of a happy place",
      "start": 96.72,
      "end": 98.525,
      "targetIndex": 7,
      "wordTimes": [
        96.72,
        96.94,
        97.2,
        97.34,
        97.56,
        97.76,
        97.94,
        98.22
      ]
    },
    {
      "section": "Chorus",
      "text": "Yeah, the world looks good from the sunny side!",
      "start": 98.54,
      "end": 103.325,
      "targetIndex": 8,
      "wordTimes": [
        98.54,
        98.92,
        98.94,
        99.24,
        99.88,
        100.36,
        100.74,
        100.98,
        101.52
      ]
    },
    {
      "section": "Chorus",
      "text": "No looking back, I'm just along for the ride",
      "start": 103.34,
      "end": 108.94,
      "targetIndex": 8,
      "wordTimes": [
        103.34,
        103.34,
        103.82,
        104.68,
        104.84,
        105.1,
        106.02,
        108.08,
        108.34
      ]
    },
    {
      "section": "Bridge",
      "text": "Tap, tap, tap to the beat of my heart",
      "start": 111.88,
      "end": 113.465,
      "targetIndex": 8,
      "wordTimes": [
        111.88,
        112.24,
        112.5,
        112.52,
        112.68,
        112.82,
        112.98,
        113.1,
        113.22
      ]
    },
    {
      "section": "Bridge",
      "text": "Knew from the very first moment to start",
      "start": 113.48,
      "end": 115.605,
      "targetIndex": 7,
      "wordTimes": [
        113.48,
        113.78,
        114.1,
        114.3,
        114.6,
        114.88,
        115.14,
        115.34
      ]
    },
    {
      "section": "Bridge",
      "text": "No dark cloud is sticking around",
      "start": 115.62,
      "end": 117.745,
      "targetIndex": 5,
      "wordTimes": [
        115.62,
        115.94,
        116.28,
        116.74,
        117.02,
        117.3
      ]
    },
    {
      "section": "Bridge",
      "text": "Not when there's joy to be found all around!",
      "start": 117.76,
      "end": 122.62,
      "targetIndex": 8,
      "wordTimes": [
        117.76,
        118.16,
        118.42,
        118.66,
        118.84,
        118.96,
        119.16,
        119.46,
        119.66
      ]
    },
    {
      "section": "Final Chorus",
      "text": "I'm waking up on the sunny side up!",
      "start": 127.44,
      "end": 129.965,
      "targetIndex": 7,
      "wordTimes": [
        127.44,
        128.04,
        128.16,
        128.52,
        128.68,
        128.8,
        129.0,
        129.36
      ]
    },
    {
      "section": "Final Chorus",
      "text": "Drinking the magic from a loving cup",
      "start": 129.98,
      "end": 132.725,
      "targetIndex": 6,
      "wordTimes": [
        129.98,
        130.16,
        131.34,
        131.66,
        131.88,
        132.02,
        132.44
      ]
    },
    {
      "section": "Final Chorus",
      "text": "Got a smile so wide that it hurts my face",
      "start": 132.74,
      "end": 135.105,
      "targetIndex": 9,
      "wordTimes": [
        132.74,
        132.96,
        133.06,
        133.22,
        133.52,
        133.84,
        134.04,
        134.16,
        134.32,
        134.58
      ]
    },
    {
      "section": "Final Chorus",
      "text": "Moving to the rhythm of a happy place",
      "start": 135.12,
      "end": 136.945,
      "targetIndex": 7,
      "wordTimes": [
        135.12,
        135.36,
        135.6,
        135.76,
        135.96,
        136.14,
        136.28,
        136.62
      ]
    },
    {
      "section": "Final Chorus",
      "text": "Yeah, the world looks good from the sunny side!",
      "start": 136.96,
      "end": 141.045,
      "targetIndex": 8,
      "wordTimes": [
        136.96,
        137.3,
        137.32,
        137.68,
        138.28,
        138.74,
        139.12,
        139.38,
        139.88
      ]
    },
    {
      "section": "Final Chorus",
      "text": "No looking back, I'm just along for the ride",
      "start": 141.06,
      "end": 146.58,
      "targetIndex": 8,
      "wordTimes": [
        141.06,
        141.58,
        142.14,
        142.88,
        143.2,
        143.42,
        144.3,
        145.56,
        145.82
      ]
    },
    {
      "section": "Outro",
      "text": "Yeah, on the sunny side up!",
      "start": 148.9,
      "end": 150.545,
      "targetIndex": 5,
      "wordTimes": [
        148.9,
        149.36,
        149.36,
        149.36,
        149.36,
        150.04
      ]
    },
    {
      "section": "Outro",
      "text": "Keep on pouring that loving cup",
      "start": 150.56,
      "end": 154.8,
      "targetIndex": 5,
      "wordTimes": [
        150.56,
        151.56,
        151.9,
        152.32,
        152.74,
        153.9
      ]
    },
    {
      "section": "Outro",
      "text": "Oh-oh-oh, feel the glow",
      "start": 157.0,
      "end": 158.925,
      "targetIndex": 3,
      "wordTimes": [
        157.0,
        157.0,
        157.28,
        158.52
      ]
    },
    {
      "section": "Outro",
      "text": "Never want this day to go!",
      "start": 158.94,
      "end": 163.945,
      "targetIndex": 5,
      "wordTimes": [
        158.94,
        160.46,
        161.38,
        161.66,
        162.1,
        162.4
      ]
    },
    {
      "section": "Outro",
      "text": "Sunny side up!",
      "start": 163.96,
      "end": 169.44,
      "targetIndex": 2,
      "wordTimes": [
        163.96,
        164.02,
        164.36
      ]
    }
  ]
};
  if (typeof module === "object" && module.exports) module.exports = song;
  else root.SUNNY_SONG = song;
})(typeof window !== "undefined" ? window : globalThis);
