/*------------------------------------------------------------------+
 | Functions used for searchable fusion table maps                  |
 | Requires jQuery                                                  |
 +-------------------------------------------------------------------*/

  var map;
  var geocoder;
  var addrMarker;
  var addrMarkerImage = 'http://derekeder.com/images/icons/blue-pushpin.png';
  
  var fusionTableId = 3153963; //replace this with the ID of your fusion table
  
  var searchRadius = 1; //in meters ~ 1/2 mile
  var recordName = "census tract";
  var recordNamePlural = "census tracts";
  var searchrecords;
  var records = new google.maps.FusionTablesLayer(fusionTableId);
  
  var searchStr;
  var searchRadiusCircle;
  
  google.load('visualization', '1', {}); //used for custom SQL call to get count
  
  function initialize() {
	$( "#resultCount" ).html("");
	$( "#tierNumber").html("");
  
  	geocoder = new google.maps.Geocoder();
    var chicago = new google.maps.LatLng(41.850033, -87.6500523);
    var myOptions = {
      zoom: 11,
      center: chicago,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"),myOptions);
	
	searchrecords = null;
	$("#txtSearchAddress").val("");
	doSearch();
  }
	
	function doSearch() 
	{
		clearSearch();
		var address = $("#txtSearchAddress").val();
		
		searchStr = "SELECT geometry FROM " + fusionTableId + " WHERE geometry not equal to ''";
		
		// because the geocode function does a callback, we have to handle it in both cases - when they search for and address and when they dont
		if (address != "")
		{
			if (address.toLowerCase().indexOf("chicago") == -1)
				address = address + " chicago";

      _trackClickEventWithGA("Search", "CPS tiers", address);	
			geocoder.geocode( { 'address': address}, function(results, status) 
			{
			  if (status == google.maps.GeocoderStatus.OK) 
			  {
  				//console.log("found address: " + results[0].geometry.location.toString());
  				map.setCenter(results[0].geometry.location);
  				map.setZoom(14);
  				
  				addrMarker = new google.maps.Marker({
  				  position: results[0].geometry.location, 
  				  map: map, 
  				  icon: addrMarkerImage,
  				  animation: google.maps.Animation.DROP,
  				  title:address
  				});
  				//drawSearchRadiusCircle(results[0].geometry.location);
  				
  				searchStr += " AND ST_INTERSECTS(geometry, CIRCLE(LATLNG" + results[0].geometry.location.toString() + "," + searchRadius + "))";
  				
  				//get using all filters
  				//console.log(searchStr);
  				searchrecords = new google.maps.FusionTablesLayer(fusionTableId, {
  					query: searchStr}
  					);
  			
  				searchrecords.setMap(map);
  				//displayCount(searchStr);
  				getTierNumber(searchStr);
			  } 
			  else 
			  {
				  alert("We could not find your address: " + status);
			  }
			});
		}
		else
		{
			//get using all filters
			searchrecords = new google.maps.FusionTablesLayer(fusionTableId, {
				query: searchStr}
				);
		
			searchrecords.setMap(map);
			displayCount(searchStr);
		}
  }
	
	function clearSearch() {
		if (searchrecords != null)
			searchrecords.setMap(null);
		if (addrMarker != null)
			addrMarker.setMap(null);
		
		records.setMap(null);
	}
	
	function refreshrecords() {
		if (searchrecords != null)
			searchrecords.setMap(map);
		else
			records.setMap(map);
	}

 function findMe() {
	  // Try W3C Geolocation (Preferred)
	  var foundLocation;
	  
	  if(navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition(function(position) {
	      foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
	      addrFromLatLng(foundLocation);
	    }, null);
	  }
	  else {
	  	alert("Sorry, we could not find your location.");
	  }
	}
	
	function addrFromLatLng(latLngPoint) {
	    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
	      if (status == google.maps.GeocoderStatus.OK) {
	        if (results[1]) {
	          $('#txtSearchAddress').val(results[1].formatted_address);
	          $('.hint').focus();
	          doSearch();
	        }
	      } else {
	        alert("Geocoder failed due to: " + status);
	      }
	    });
	  }
	
	function drawSearchRadiusCircle(point) {
	    var circleOptions = {
	      strokeColor: "#4b58a6",
	      strokeOpacity: 0.3,
	      strokeWeight: 1,
	      fillColor: "#4b58a6",
	      fillOpacity: 0.05,
	      map: map,
	      center: point,
	      clickable: false,
	      zIndex: -1,
	      radius: parseInt(searchRadius)
	    };
	    searchRadiusCircle = new google.maps.Circle(circleOptions);
	}
	
	function getFTQuery(sql) {
		var queryText = encodeURIComponent(sql);
		return new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq='  + queryText);
	}
	
	function displayCount(searchStr) {
	  //set the query using the parameter
	  searchStr = searchStr.replace("SELECT geometry ","SELECT Count() ");
	  
	  //set the callback function
	  getFTQuery(searchStr).send(displaySearchCount);
	}

	function displaySearchCount(response) {
	  var numRows = 0;
	  if (response.getDataTable().getNumberOfRows() > 0)
	  	numRows = parseInt(response.getDataTable().getValue(0, 0));
	  var name = recordNamePlural;
	  if (numRows == 1)
		name = recordName;
	  $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html(addCommas(numRows) + " " + name + " found");
      });
	  $( "#resultCount" ).fadeIn();
	}
	
	function getTierNumber(searchStr) {
	  //set the query using the parameter
	  searchStr = searchStr.replace("SELECT geometry ","SELECT TIER ");
	  
	  //set the callback function
	  getFTQuery(searchStr).send(displayTierNumber);
	}
	
	function displayTierNumber(response) {
	  var tier = "";
	  if (response.getDataTable().getNumberOfRows() > 0)
	  	tier = parseInt(response.getDataTable().getValue(0, 0));
	  $( "#tierNumber" ).fadeOut(function() {
        $( "#tierNumber" ).html("You are in tier " + tier + ".");
      });
	  $( "#tierNumber" ).fadeIn();
	}
	
	function getTierDemographics(tier) {
	 var sql = "SELECT ";
	 sql += "AVERAGE('TIER'), "
	 sql += "AVERAGE('Median Family Income'), ";
	 sql += "AVERAGE('Single Parent Families, rate'), ";
	 sql += "AVERAGE('People over Five Years Old who Speak Language other than English at Home, rate'), ";
	 sql += "AVERAGE('Homeowner Occupied Households, rate'), ";
	 sql += "AVERAGE('People over 18 with less than HS Education, rate'), ";
	 sql += "AVERAGE('People over 18 with HS Diploma or Equivalent, rate'), ";
	 sql += "AVERAGE('People over 18 Some Post-HS Education, rate'), ";
	 sql += "AVERAGE('People with a BA Degree or Higher, rate') ";
	 sql += "FROM " + fusionTableId + " WHERE 'TIER' = " + tier;
	 
	  //set the callback function
	  //console.log(getFTQuery(sql));
	  getFTQuery(sql).send(displayTierDemographics);
	}
	
	function displayTierDemographics(response) {
	  var table = "";
	  var numCols = response.getDataTable().getNumberOfColumns();
	  var tier = response.getDataTable().getValue(0, 0);
	  //console.log(numCols);
	  if (response.getDataTable().getNumberOfRows() > 0) {
	    table += "<td><strong>Tier&nbsp;" + tier + "</strong></td>";
	  	table += "<td id='tier-" + tier + "-income'>" + response.getDataTable().getValue(0, 1) + "</td>";
	  	
	  	for(i = 2; i < numCols; i++) {
	  	  table += "<td>" + toPercentage(response.getDataTable().getValue(0, i)) + "</td>";
	  	}
	   }
	   
	   //console.log("tier-" + response.getDataTable().getValue(0, 0) + "-demographics")
	   //console.log(table);
     $("#tier-" + tier + "-demographics").html(table);
     $("#tier-" + tier + "-income").formatCurrency({roundToDecimalPlace: 0});
	}
	
	function addCommas(nStr)
	{
		nStr += '';
		x = nStr.split('.');
		x1 = x[0];
		x2 = x.length > 1 ? '.' + x[1] : '';
		var rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
	}
	function toPercentage(nStr) {
	 return (parseFloat(nStr) * 100).toFixed(1) + "%"
	}