var eventsApp = angular.module('eventsApp', ['ui.router']);

eventsApp.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/listing');
    
    $stateProvider
            .state('app.events.listing', {
                url: '/listing',
                views: {
                    'main@': {
                        templateUrl: 'pages/listing.html',
                        controller: 'ListingController as vm'
                    }
                }
            })
            .state('app.events.single', {
            	url: '/single/:id',
            	views: {
            		'main@': {
            			templateUrl: 'pages/single.html',
            			controller: 'SingleController as vm'
            		}
            	}
            })
            .state('app.events.edit', {
            	url: '/edit/:id',
            	views: {
            		'main@': {
            			templateUrl: 'pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            .state('app.events.new', {
            	url: '/new',
            	views: {
            		'main@': {
            			templateUrl: 'pages/new.html',
            			controller: 'NewController as vm'
            		}
            	}
            })
            /*.state('app.events.apply', {
            	url: '/apply/:id'
            })*/
            ;
        
});

/*var apiURL = '/api';

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
});*/