/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 8/15/2012
 *
 */

var MapsLib = MapsLib || {};
var MapsLib = {

  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info

  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "1suTSp6yMr_ZlKVw_fayo5ovcj960Ysm12wHSmnA",
  tierDiffTableId:    "1c8_4xQV7Vw21m5kDZqnD7Kz_QCOdrlXyF_RU4gc",

  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/
  //*Important* this key is for demonstration purposes. please register your own.
  googleApiKey:       "AIzaSyAcsnDc7_YZskPj4ep3jT_fkpB3HI_1a98",

  //name of the location column in your Fusion Table.
  //NOTE: if your location column name has spaces in it, surround it with single quotes
  //example: locationColumn:     "'my location'",
  locationColumn:     "geometry",

  map_centroid:       new google.maps.LatLng(41.8781136, -87.66677856445312), //center that your map defaults to
  locationScope:      "chicago",      //geographical area appended to all address searches
  recordName:         "tier",       //for showing number of results
  recordNamePlural:   "tiers",

  searchRadius:       0.0001,            //in meters ~ 1/2 mile
  defaultZoom:        11,             //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage: 'http://derekeder.com/images/icons/blue-pushpin.png',
  currentPinpoint: null,

  initialize: function() {
    $( "#tierNumber").html("");

    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    MapsLib.searchrecords = null;

    //reset filters
    $("#txtSearchAddress").val(MapsLib.convertToPlainString($.address.parameter('address')));

    //run the default search
    MapsLib.doSearch();
  },

  initializeDiffMap: function() {
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.tierDiffTableId,
        select: MapsLib.locationColumn
      }
    });
    MapsLib.searchrecords.setMap(map);
  },

  searchFor: function(address) {
    $("#txtSearchAddress").val(address);
    MapsLib.doSearch();
    return false;
  },

  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#txtSearchAddress").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";

    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;

      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;

          $.address.parameter('address', encodeURIComponent(address));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);

          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint,
            map: map,
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title:address
          });

          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";

          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
          MapsLib.getTierNumber(whereClause);
        }
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },

  submitSearch: function(whereClause, map, location) {
    //get using all filters
    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  whereClause
      }
    });
    MapsLib.searchrecords.setMap(map);
    MapsLib.enableMapTips();
  },

  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);
  },

  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;

    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },

  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#txtSearchAddress').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },

  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);

    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },

  enableMapTips: function () {
    MapsLib.searchrecords.enableMapTips({
      select: "'Tier 2012'",
      from: MapsLib.fusionTableId,
      geometryColumn: MapsLib.locationColumn,
      delay: 100
    });
  },

  displayCount: function(whereClause) {
    var selectColumns = "Count()";
    MapsLib.query(selectColumns, whereClause,"MapsLib.displaySearchCount");
  },

  displaySearchCount: function(json) {
    MapsLib.handleError(json);
    var numRows = 0;
    if (json["rows"] != null)
      numRows = json["rows"][0];

    var name = MapsLib.recordNamePlural;
    if (numRows == 1)
    name = MapsLib.recordName;
    $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
      });
    $( "#resultCount" ).fadeIn();
  },

  getTierNumber: function(whereClause) {
    MapsLib.query("'Tier 2012'", whereClause,"MapsLib.displayTierNumber");
  },

  displayTierNumber: function(json) {
    MapsLib.handleError(json);
    var tier = "";
    if (json["rows"] != null)
      tier = json["rows"][0];

    $( "#tierNumber" ).fadeOut(function() {
        $( "#tierNumber" ).html("You are in Tier " + tier);
      });
    $( "#tierNumber" ).fadeIn();
  },

  getTierDemographics: function(tier) {
    var selectColumns = "AVERAGE('Tier 2012'), "
    selectColumns += "AVERAGE('Median Family Income'), ";
    selectColumns += "AVERAGE('Single Parent Families, rate'), ";
    selectColumns += "AVERAGE('People over Five Years Old who Speak Language other than English at Home, rate'), ";
    selectColumns += "AVERAGE('Homeowner Occupied Households, rate'), ";
    selectColumns += "AVERAGE('People over 18 with less than HS Education, rate'), ";
    selectColumns += "AVERAGE('People over 18 with HS Diploma or Equivalent, rate'), ";
    selectColumns += "AVERAGE('People over 18 Some Post-HS Education, rate'), ";
    selectColumns += "AVERAGE('People with a BA Degree or Higher, rate') ";

    var whereClause = "'Tier 2012' = " + tier;
    MapsLib.query(selectColumns, whereClause,"MapsLib.displayTierDemographics");
  },

  displayTierDemographics: function(json) {
    MapsLib.handleError(json);
    var table = "";
    var rows = json["rows"];
    var cols = json["columns"];
    var tier = rows[0][0];


    if (rows != null) {
      table += "<td><strong>Tier&nbsp;" + tier + "</strong></td>";
      table += "<td id='tier-" + tier + "-income'>" + rows[0][1] + "</td>";

      for(i = 2; i < cols.length; i++) {
        table += "<td>" + MapsLib.toPercentage(rows[0][i]) + "</td>";
      }
     }

     //console.log("tier-" + response.getDataTable().getValue(0, 0) + "-demographics")
     $("#tier-" + tier + "-demographics").html(table);
     $("#tier-" + tier + "-income").formatCurrency({roundToDecimalPlace: 0});
  },

  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },

  toPercentage: function(nStr) {
   return (parseFloat(nStr) * 100).toFixed(1) + "%"
  },

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  }
}