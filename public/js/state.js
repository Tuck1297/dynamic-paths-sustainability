let graph_data = %%Data_Placeholder%%
let type_data = [%%Data_Placeholder_2%%]
let table = document.getElementById('table')
table.innerHTML = '%%table_data%%'

var chart = new CanvasJS.Chart("chartContainer", {
    theme: "light2",
    animationEnabled: true,
    backgroundColor: null,
    exportFileName: "Sector Energy Consumed",
    exportEnabled: true,
    axisX: {
        title: "Year",
        labelFontColor: "black",
        tickLength: 10,
        gridColor: null,
        valueFormatString: "##",
    },
    axisY: {
        title: "Trillion BTU",
        suffix: " BTU",
        titleFontColor: "black",
        labelFontColor: "black",
        interlacedColor: "rgba(1,77,101,.2)",
        tickColor: "rgba(0, 0, 133, 0.5)",
        gridColor: "rgba(0, 0, 133, 0.5)",
        tickLength: 10,
        valueFormatString: "##.##",
    },
    legend: {
        cursor: "pointer",
        fontSize: 16,
    },
    data: graph_data
});

chart.render();

var pie = new CanvasJS.Chart("pie", {
    backgroundColor: null,
    animationEnabled: true,
    exportFileName: "Sector Energy Consumed",
    exportEnabled: true,
    data: [{
        type: "doughnut",
        indexLabelFontColor: "black",
        showInLegend: false,
        legendText: "{label}",
        toolTipContent: "{label}: <strong>{y}</strong> Trillion (BTU)",
        indexLabel: "{label} {y}",
        dataPoints: type_data,
    }]
});
pie.render();