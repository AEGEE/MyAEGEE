var apiURL = '/api';

var eventsApp = angular.module('eventsApp', ['ngRoute']);


eventsApp.config(['$routeProvider', function($routeProvider) {
        $routeProvider

            // Listing all events
            .when('/', {
                templateUrl : 'pages/listing.html',
                controller  : 'listingController'
            })

            // Event details
            .when('/single/:event_id', {
                templateUrl : 'pages/single.html',
                controller  : 'singleController'
            })

            // Edit event
            .when('/edit/:event_id', {
            	templateUrl : 'pages/new.html',
            	controller  : 'editEventController'
            })

            // New event
            .when('/edit', {
            	templateUrl : 'pages/new.html',
            	controller  : 'editEventController'
            })
    }]);

eventsApp.controller('mainController', function($scope) {
	$scope.hashify = function(url) {return '/#' + url};;
});