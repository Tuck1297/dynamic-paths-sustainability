// Built-in Node.js modules
let fs = require('fs');
let path = require('path');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');
const { debug } = require('console');


let public_dir = path.join(__dirname, 'public');
let template_dir = path.join(__dirname, 'templates');
let db_filename = path.join(__dirname, 'db', 'Energy.sqlite3');
let js_dir = path.join(__dirname, 'public/js');

let app = express();
let port = 8000;

let canvasQueryParams = []
let canvasQuery = `SELECT * from AnnualSectorEnergy`

let states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California'
    , 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii'
    , 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana'
    , 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi'
    , 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey'
    , 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma'
    , 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota'
    , 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington'
    , 'West Virginia', 'Wisconsin', 'Wyoming']

let months = ['January', 'Feburary', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']

let sectors = ['Commercial', 'Residential', 'Industrial', 'Transportation', 'Electric']


// Open SQLite3 database (in read-only mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Serve static files from 'public' directory
app.use(express.static(public_dir));

// GET request handler for home page '/' (redirect to desired route)
app.get('/', (req, res) => {
    // desired route is homepage --> allows us to hide template file storage
    let home = '/homepage';
    res.redirect(home);
});

// Dynamic File path for homepage --> index.html
app.get('/homepage', (req, res) => {
    createPageFromDynamicTemplate('index.html', res, (page) => {
        // If there was an retrieval error -- redirect to 404 error page
        if (page.toString().slice(0, 5) == 'Error') {
            display404Page(res, `Error: Internal problem!`)
            return
        }
        let response = page
            .toString()
            .replace('%%Title_Placeholder%%', 'Homepage')
            .replace('%%route%%', '/javascript/home')
        res.status(200).type('html').send(response)
    })
})

app.get('/javascript/home', (req, js_res) => {

    readFile(path.join(js_dir, 'script.js'), js_res)
        .then(js_page => {
            let js_response = js_page.toString()
            js_res.status(200).type('js').send(js_response)
        })
})

// Dynamic path for Sector Annual Data
app.get('/sector/:sector/annual/:year', (req, res) => {
    let sector = req.params.sector
    let year = req.params.year

    sector = capitalize(sector)

    if (sectors.indexOf(sector) == -1) {
        display404Page(res, `Error: no data for /sector/${sector}/annual/${year}`)
        return
    }

    checkBounds(year, null, "MonthlySectorEnergy")
        .then((result) => {
            let years_info = { smallest_year: result[0], largest_year: result[1] }

            canvasQuery =
                `SELECT month, total, biomass, waste, ethenol, wood, hydro_electric, geothermal, solar, wind,
            biodiesel, renewable_diesel, other_biodiesel FROM MonthlySectorEnergy JOIN Sector ON 
            MonthlySectorEnergy.sector_id=Sector.sector_id JOIN Month ON Month.month_id=MonthlySectorEnergy.month_id 
            WHERE Sector.sector_name = ? AND MonthlySectorEnergy.year = ?`
            canvasQueryParams = [sector, year]

            createPageFromDynamicTemplate('sector.html', res, (page) => {
                let [prevcalculatedYear, nextcalculatedYear] = calculateNextAndPrevLinksYear(year, years_info);
                let response = page
                    .toString()
                    .replace('%%Title_Placeholder%%', `${sector}:${year}`)
                    .replace('%%route%%', '/javascript/sector')
                    .replace('%%Sector_Title_Placeholder%%', `${sector}:${year}`)
                    .replace('%%Image_Placeholder_1%%', `/images/${sector}_logo.png`)
                    .replace('%%Image_Descriptor_1%%', `${sector} Logo`)
                    .replace('%%Image_Placeholder_2%%', `/images/sustain_bg.png`)
                    .replace('%%Sector_Type%%', `${sector}`)
                    .replace('%%link_prev%%', `/sector/${sector}/annual/${prevcalculatedYear}`)
                    .replace('%%link_next%%', `/sector/${sector}/annual/${nextcalculatedYear}`)
                res.status(200).type('html').send(response)
            })
        })
        .catch((err) => {
            display404Page(res, `Error: no data for sector/${sector}/annual/${year}`)
        })
})

app.get('/javascript/sector', (req, js_res) => {
    fs.readFile(path.join(js_dir, 'sector.js'), 'utf-8', (err, js_page) => {
        if (err) {
            js_res.status(404).type('js').send(`Error: ${err}`)
            return
        }
        db.all(canvasQuery, canvasQueryParams, (err, rows) => {
            if (err) {
                js_res.status(404).type('js').send(`Error: ${err}`)
                return
            }
            if (rows.length === 0 || rows[0].total == '') {
                javascriptErrorHandle(js_res)
            }

            let keys = Object.keys(rows[0])

            let table = createTable(rows[0], rows)

            let lineGraph = createAndPopulateLineGraph(keys, rows, 'month')

            let donutGraph = createAndPopulateDonutGraph(keys, rows)

            let js_response = js_page
                .toString()
                .replace('%%Data_Placeholder%%', JSON.stringify(lineGraph, null, 2))
                .replace('%%Data_Placeholder_2%%', donutGraph)
                .replace('%%table_data%%', table)
            js_res.status(200).type('js').send(js_response)
        })
    })
})

// Dynamic path for State Data
app.get('/state/:state', (req, res) => {
    let state = req.params.state

    state = capitalize(state)

    if (states.indexOf(state) == -1) {
        display404Page(res, `Error: no data for /state/${state}`)
        return
    }

    canvasQuery = `SELECT year, coal, natural_gas, distillate_fuel_oil, 
    hgl, jet_fuel, gasoline, resitual_fuel_oil, other, nuclear_electric, 
    hydro_electric, wood_and_waste, ethanol, biodiesel, losses_and_coproducts, 
    geothermal, solar, wind FROM StatesEnergy JOIN States WHERE StatesEnergy.state_id = 
    States.state_id AND States.state = ?`
    canvasQueryParams = [state.toUpperCase()]

    createPageFromDynamicTemplate('state.html', res, (page) => {
        if (page.toString().slice(0, 5) == 'Error') {
            display404Page(res, `Error: no data for /state/${state}`)
            return
        }

        let [prevStateIndex, nextStateIndex] = calculateNextAndPrevIndexState(state)

        let finalPage = page
            .replace('%%route%%', `/javascript/state`)
            .replace('%%Title_Placeholder%%', state)
            .replace('%%Image_Placeholder_1%%', `/images/${state.toLowerCase()}.png`)
            .replace('%%Image_Descriptor_1%%', `${state} Image`)
            .replace('%%State_Title_Placeholder%%', state)
            .replace('%%Image_Placeholder_2%%', `/images/sustain_bg.png`)
            .replace('%%link_prev%%', `/state/${states[prevStateIndex]}`)
            .replace('%%link_next%%', `/state/${states[nextStateIndex]}`)
        res.status(200).type('html').send(finalPage)
    })
})

app.get('/javascript/state', (req, js_res) => {
    fs.readFile(path.join(js_dir, 'state.js'), 'utf-8', (err, js_page) => {
        if (err) {
            js_res.status(404).type('js').send(`Error: ${err}`)
            return
        }

        db.all(canvasQuery, canvasQueryParams, (err, rows) => {
            if (err) {
                js_res.status(404).type('js').send(`Error: ${err}`)
                return
            }
            if (rows.length === 0 || rows[0].total == '') {
                javascriptErrorHandle(js_res)
            }

            let keys = Object.keys(rows[0])

            let table = createTable(rows[0], rows)

            let lineGraph = createAndPopulateLineGraph(keys, rows, 'year')

            let donutGraph = createAndPopulateDonutGraph(keys, rows)

            let js_response = js_page
                .toString()
                .replace('%%Data_Placeholder%%', JSON.stringify(lineGraph, null, 2))
                .replace('%%Data_Placeholder_2%%', donutGraph)
                .replace('%%table_data%%', table)
            js_res.status(200).type('js').send(js_response)
        })
    })
})

// Dynamic path for Total Annual Data
app.get('/total_annual/:year', (req, res) => {
    let year = parseInt(req.params.year)

    canvasQuery = `SELECT Month.month, SUM(MonthlySectorEnergy.total) AS total, SUM(MonthlySectorEnergy.biomass) AS biomass,
            SUM(MonthlySectorEnergy.waste) AS waste, SUM(MonthlySectorEnergy.ethenol) AS ethenol,        
            SUM(MonthlySectorEnergy.wood) AS wood, SUM(MonthlySectorEnergy.hydro_electric) AS hydro_electric,        
            SUM(MonthlySectorEnergy.geothermal) AS geothermal, SUM(MonthlySectorEnergy.solar) AS solar,        
            SUM(MonthlySectorEnergy.wind) AS wind, SUM(MonthlySectorEnergy.biodiesel) AS biodiesel,        
            SUM(MonthlySectorEnergy.renewable_diesel) AS renewable_diesel, 
            SUM(MonthlySectorEnergy.other_biodiesel) AS other_biodiesel FROM MonthlySectorEnergy 
            JOIN Sector ON MonthlySectorEnergy.sector_id = Sector.sector_id JOIN Month ON MonthlySectorEnergy.month_id = Month.month_id 
            WHERE MonthlySectorEnergy.Year = ? GROUP BY Month.month ORDER BY Month.month_id;`
    canvasQueryParams = [year]

    checkBounds(year, null, "MonthlySectorEnergy")
        .then((result) => {
            let years_info = { smallest_year: result[0], largest_year: result[1] }

            createPageFromDynamicTemplate('total.html', res, (page) => {

                let [prevcalculatedYear, nextcalculatedYear] = calculateNextAndPrevLinksYear(year, years_info);

                let images = [
                    {
                        desc: "Bio Fuel Field",
                        path: "biofuel_field.jpg"
                    },
                    {
                        desc: "Bio Fuel Plane",
                        path: "biofuel_plane.jpg"
                    },
                    {
                        desc: "Solar Energy Farm",
                        path: "solar.jpg"
                    },
                    {
                        desc: "Solor Energy Farm",
                        path: "solar_2.jpg"
                    },
                    {
                        desc: "Wood Chips",
                        path: "wood_chips.jpg"
                    },
                    {
                        desc: "Wind Turbine",
                        path: "wind-turbine.jpg"
                    },
                    {
                        desc: "Field of Wind Turbines",
                        path: "wind.jpg"
                    },
                    {
                        desc: "Commercial Factory",
                        path: "Commercial.jpg"
                    },
                    {
                        desc: "Electric Truck",
                        path: "electric_truck.jpg"
                    },
                    {
                        desc: "Hydro-Electric Power Plant",
                        path: "hydroelectric.jpg"
                    }
                ]
                let img = images[Math.floor(Math.random() * 5)]
                res.status(200).type('html').send(
                    page.replace('%%route%%', `/javascript/total`)
                        .replace('%%Title%%', `Annual: ${year}`)
                        .replace('%%Image_Placeholder_1%%', `/images/${img.path}`)
                        .replace('%%Image_Descriptor_1%%', img.desc)
                        .replace('%%Image_Placeholder_2%%', `/images/sustain_bg.png`)
                        .replace('%%Title_Placeholder%%', `Annual: ${year}`)
                        .replace('%%link_prev%%', `/total_annual/${prevcalculatedYear}`)
                        .replace('%%link_next%%', `/total_annual/${nextcalculatedYear}`)
                )
            })
        })
        .catch((err) => {
            display404Page(res, `Error: no data for total_annual/${year}`)
        })
})

app.get('/javascript/total', (req, js_res) => {
    fs.readFile(path.join(js_dir, 'total.js'), 'utf-8', (err, js_page) => {
        if (err) {
            js_res.status(404).type('js').send(`Error: ${err}`)
            return
        }
        db.all(canvasQuery, canvasQueryParams, (err, rows) => {
            if (err) {
                js_res.status(404).type('js').send(`Error: ${err}`)
                return
            }
            if (rows.length === 0 || rows[0].total == '') {
                javascriptErrorHandle(js_res)
            }

            let keys = Object.keys(rows[0])

            let table = createTable(rows[0], rows)

            let lineGraph = createAndPopulateLineGraph(keys, rows, 'month')

            let donutGraph = createAndPopulateDonutGraph(keys, rows)

            let js_response = js_page
                .toString()
                .replace('%%Data_Placeholder%%', JSON.stringify(lineGraph, null, 2))
                .replace('%%Data_Placeholder_2%%', donutGraph)
                .replace('%%table_data%%', table)
            js_res.status(200).type('js').send(js_response)
        })
    })
})

/* Reads in a file from an input directory -- retirects to 404 error page if not found */
function readFile(file, res) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, (err, template) => {
            if (err) {
                console.log(err)
                display404Page(res, `Error: Internal problem!`)
                return
            }
            else
                resolve(template)
        })
    })
}
/* Executes the input query -- redirects to 404 error page if not found */
function callDatabase(query, params, res) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            // Send error page as response if there is a SQL error
            if (err) {
                display404Page(res, `Error: no data for the following paramaters: ${params}`)
                console.error(err)
                reject(err)
                return
            }
            if (rows === undefined || rows.length === 0) {
                display404Page(res, `Error: no data for the following parameters: ${params}`)
                console.error(err)
                reject(`DB result is empty for query ${query}, ${params}`)
                return
            }
            resolve(rows)
        })
    })
}
// dbType will either be AnnualEnergy or MonthlyEnergy
//AnnualEnergy or MonthlyEnergy
function checkBounds(year, month, dbType) {
    return new Promise((resolve, reject) => {
        if (Number.isInteger(parseInt(year)) == false) {
            reject(false)
        }
        db.all(`SELECT MAX(year) as max_year, MIN(year) as min_year FROM ${dbType}`, [], (err, rows) => {
            if (err) {
                console.log(err)
                reject(err)
                return
            }
            let [min_year, max_year] = [rows[0].min_year, rows[0].max_year]

            if (year < min_year || year > max_year || year < min_year || year > max_year) {
                if (months.includes(month) == false) {
                    reject(false)
                }
                reject(false)
            } else if (months.includes(month) == false && month != null) {
                reject(false)
            }
            resolve([min_year, max_year])
        })
    })
}

/* Capitalizes the first letter of word */
function capitalize(value) {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1, value.length)}`
}

/* Creates table header and populates with rows data */
function createTable(headerData, rows) {
    let header = formatTableHeaderData(headerData)
    let eachRow = formatTableData(rows)
    let table = `<tr>${header}</tr>${eachRow}`
    table = table.replace(/,/g, '')
    return table
}

/* Formats data to be displayed in a table */
function formatTableData(data) {
    return data.map((x) => {
        let keys = Object.keys(x)
        let eachColumn = keys.map((y) => {
            let currVal = x[y]
            if (currVal == '') {
                currVal = 0;
            }
            return `<td>${currVal}</td>`
        })
        return `<tr>${eachColumn}</tr>`
    })
}

/* Formats data to be displayed in table header */
function formatTableHeaderData(data) {
    let keys = Object.keys(data)
    let header = ``
    keys.forEach((x) => {
        header += `<th>${capitalize(x).replaceAll("_", " ")}</th>`
    })
    return header
}

/* Creates line graph structure and populates it with rows data */
function createAndPopulateLineGraph(keys, rows, type) {
    let lineGraph = createElementSkeleton(keys)
    if (type == 'year') {
        populateDataLineGraphYear(lineGraph, rows, keys)
    } else {
        populateDataLineGraphMonth(lineGraph, rows, keys)
    }
    return lineGraph
}

/* For line graph it creates a working skeleton that data is added to */
function createElementSkeleton(keys) {
    let format_data = [];
    keys.forEach((y) => {
        if (y !== 'total' && y !== 'biomass' && y !== 'YEAR' && y != 'month') {
            format_data.push({
                name: `${capitalize(y).replaceAll("_", " ")}`,
                type: "spline",
                xValueFormatString: "##",
                yValueFormatString: "##0.### BTU",
                showInLegend: true,
                lineDashType: "shortDashDot",
                dataPoints: []
            })
        } else {
            format_data.push({
                name: `${y.replaceAll("_", " ")}`,
                type: "spline",
                xValueFormatString: "##",
                yValueFormatString: "###.### BTU",
                showInLegend: false,
                lineDashType: "shortDashDot",
                dataPoints: []
            })
        }
    })
    return format_data;
}

/* For line graph populates data where it is plotted by month */
function populateDataLineGraphMonth(lineGraph, rows, keys) {
    lineGraph.forEach((x, i) => {
        rows.forEach((row, j) => {
            let currKey = keys[i]
            if (currKey !== 'total' && currKey !== 'biomass') {
                let currData = row[currKey]
                if (currData == '') {
                    currData = 0
                }
                x.dataPoints.push({ x: j + 1, y: parseFloat(currData) })
            }
        })
    })
}

/* For line graph populates state where it is plotted by year */
function populateDataLineGraphYear(lineGraph, rows, keys) {
    lineGraph.forEach((x, i) => {
        rows.forEach((row, j) => {
            let currYear = row.YEAR;
            let currKey = keys[i]
            if (currKey !== 'YEAR') {
                let currData = row[currKey]
                if (currData == '') {
                    currData = 0
                }
                x.dataPoints.push({ x: parseInt(currYear), y: parseFloat(currData) })
            }
        })
    })
}

/* For donut graph sums data across sectors and organizes by month */
function buildAndSumDataAcrossSectorsByMonth(keys, rows) {
    let object = {}
    keys.forEach((key) => {
        object[key] = 0
    })
    // Sums up all data from all sectors for each month and each type
    rows.forEach((row) => {
        keys.forEach((key) => {
            object[key] += row[key]
        })
    })
    return object
}

/* Creates structure for donut graph data and populates it with rows data */
function createAndPopulateDonutGraph(keys, rows) {
    let sumObjectGraph2 = buildAndSumDataAcrossSectorsByMonth(keys, rows)
    let donutGraph = populateDataDonutGraph(keys, sumObjectGraph2)
    return donutGraph
}

/* Populates data to display to donut graph */
function populateDataDonutGraph(keys, dataObject) {
    let donutGraph = ``
    keys.forEach((key) => {
        let data = parseFloat(dataObject[key])
        if (data != 0) {
            if (key !== 'biomass' && key !== 'total' && key !== 'month' && key !== "YEAR") {
                donutGraph += `{ y: ${data}, label: "${capitalize(key).replaceAll("_", " ")}"},`
            }
        }
    })
    return donutGraph
}

/* Determines based on passed in data what the next and prev page links are for total and sector paths */
function calculateNextAndPrevLinksYear(year, years_info) {
    let prevcalculatedYear = parseInt(year) - 1
    let nextcalculatedYear = parseInt(year) + 1
    if (nextcalculatedYear > years_info.largest_year) {
        nextcalculatedYear = years_info.smallest_year
    }
    if (prevcalculatedYear < years_info.smallest_year) {
        prevcalculatedYear = years_info.largest_year
    }

    return [prevcalculatedYear, nextcalculatedYear]
}

/* Determines based on passed in data what the next and prev page links are for state path */
function calculateNextAndPrevIndexState(state) {
    let currStateIndex = states.indexOf(state);
    let nextStateIndex = currStateIndex + 1;
    let prevStateIndex = currStateIndex - 1;
    if (prevStateIndex < 0) {
        prevStateIndex = states.length - 1;
    }
    if (nextStateIndex > states.length - 1) {
        nextStateIndex = 0;
    }
    return [prevStateIndex, nextStateIndex]
}

/* Builds dynamic page that client wants to visit */
function createPageFromDynamicTemplate(contentFileName, res, onContentInserted) {
    let contentPath = path.join(template_dir, contentFileName)
    let templatePath = path.join(template_dir, 'dynamic_route_template.html')

    fs.readFile(contentPath, (err, content) => {
        if (err) {
            display404Page(res, `Error: internal problem!`)
            console.error(err)
            return
        }
        fs.readFile(templatePath, 'utf-8', (err, template) => {
            if (err) {
                display404Page(res, `Error: internal problem!`)
                console.error(err)
                return
            }

            populateNavigation(template, res, (navigationTemplate) => {
                let page = navigationTemplate.replace('%%Placeholder_Content%%', content)
                onContentInserted(page)
            })
        })
    })
}

/* Builds the navigation path for all dynamic pages */
function populateNavigation(template, res, callback) {
    let annualYearsQuery = `SELECT DISTINCT year FROM MonthlySectorEnergy ORDER BY year`
    let monthlyYearsQuery = `SELECT DISTINCT year FROM MonthlyEnergy ORDER BY year`
    let sectorNamesQuery = `SELECT sector_name FROM Sector;`

    // callDatabase() will perform a 404 redirect, so no need to do that here.
    Promise.all([
        callDatabase(annualYearsQuery, [], res),
        callDatabase(monthlyYearsQuery, [], res),
        callDatabase(sectorNamesQuery, [], res)
    ]).then((results) => {
        let [annualYears, monthlyYears, sectorNames] = results
        monthlyYears = monthlyYears.map((r) => r.year)
        annualYears = annualYears.map((r) => r.Year)
        sectorNames = sectorNames.map((r) => r.sector_name)
        let sectorAnnualPlaceholder =
            createNestedListElements(sectorNames, annualYears, (sn, y) =>
                `<a href="/sector/${sn}/annual/${y}">${y}</a>`
            )
        let annualPlaceholder =
            createListElements(annualYears, (y) =>
                `<a href="/total_annual/${y}">${y}</a>`
            )
        let statePlaceholder =
            createListElements(states, (s) =>
                `<a href="/state/${s}">${s}</a>`
            )

        // Replace string placeholders
        let response = template
            .toString()
            .replace('%%List_Placeholder_Total_Year%%', annualPlaceholder)
            .replace('%%List_Placeholder_Sector_Annual%%', sectorAnnualPlaceholder)
            .replace('%%List_Placeholder_State%%', statePlaceholder)

        callback(response)
    })
        .catch((err) => {
            console.error(err)
        })
}

/* Displays 404 page with passed message to client */
function display404Page(res, message) {
    fs.readFile(path.join(template_dir, 'file_not_found.html'), (err, template) => {
        if (err) {
            res.status(404).type('text').send(`${message} ~ Please check your request and try again...`)
        } else {
            let response = template
                .toString()
                .replace('%%err_page_placeholder%%', message)
            res.status(404).type('html').send(response)
        }
    })
}

/* Displays error message to client */
function javascriptErrorHandle(js_res) {
    let JavaErrorRes = `
                let graph_1 = document.getElementById('chartContainer')
                let graph_2 = document.getElementById('pie')
                let message = "Sorry there is currently no data available."
                graph_1.innerHTML = message
                graph_2.innerHTML = message`

    js_res.status(200).type('js').send(JavaErrorRes)
    return
}

/* Builds nested navigation path where needed */
function createNestedListElements(parentList, childList, childTransform) {
    let elements = []

    for (let p of parentList) {
        elements.push(`<li><a>${p}</a> <ul class="menu navParent">`)

        for (let c of childList) {
            elements.push(createListElement(childTransform(p, c)))
        }
        elements.push(`</ul><div class="sidebar_buffer"></div></li>`)
    }
    return elements.join('')
}

/* Wraps <li> tags around all input list elements and returns all concatnated together */
function createListElements(list, transform) {
    return list
        .map(transform)
        .map(createListElement)
        .join('')
}

/* Wraps content with <li> tag */
function createListElement(content) {
    return `<li>${content}</li>`
}

app.listen(port, () => {
    console.log('Now listening on port ' + port);
})