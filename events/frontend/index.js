var apiURL = '/api';

var eventsApp = angular.module('eventsApp', ['ngRoute']);



eventsApp.config(function($routeProvider, $locationProvider) {
        $routeProvider

            // route for the home page
            .when('/', {
                templateUrl : 'pages/listing.html',
                controller  : 'listingController'
            })

            // route for the about page
            .when('/single/:event_id', {
                templateUrl : 'pages/single.html',
                controller  : 'singleController'
            })

		// use the HTML5 History API
        //$locationProvider.html5Mode(true);
    });

eventsApp.controller('mainController', function($scope) {
	$scope.hashify = function(url) {return '/#' + url};
});