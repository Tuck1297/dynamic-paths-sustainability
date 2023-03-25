![Alt text](homepage_img.JPG)

# Dynamic Website Server Project

This project was a team assignment in participation of a web development course taken at the University of St. Thomas. The goal of this project was to build a Node.js server that handles dynamic website paths. The topic that was chosen was sustainability. The group I was part of chose renewable energy consumption. The project that you see in this repository has been modified and cleaned up by Tucker to better represent his skills and understanding of this topic.  


## Directory Structure
```
/home
    /total
        /annual/:year
    /sector
        /annual/:year
    /state/:state
```

## Plug and Play

This project is hosted online. You can check it out [here](https://renewable-energy.onrender.com). 

If you want to run it in your local environment take a look at the requirements and steps below.

~ Requirements ~

1. Node.js must be installed 
2. Recommended to host this project in Visual Studio Code

~ Steps ~

1. Download the code from this repository
2. Navigate to where file was placed on local envronment in IDE
3. In Terminal
    - 1. Install Dependencies: ``` npm install ```
    - 2. Run Project: ``` Node server.js ```
4. Go to desired browser and go to following url: localhost:8000/homepage